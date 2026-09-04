import { env } from "cloudflare:workers";
import { z } from "zod";
import { getR2Binding, R2 } from "@/lib/r2";
import { checkIPRateLimit, getClientIP } from "@/lib/rate-limit/ip";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { COOKIE_NAME, createSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { generateTempKey, MAX_FILE_SIZE, validatePDFBuffer } from "@/lib/utils/validation";
const MIN_PDF_SIZE = 100;

export async function POST(request: Request) {
  try {
    // SAFETY: env is untyped Cloudflare Workers binding; cast bridges to typed CloudflareEnv. X-Filename header is validated for length and sanitized before use.
    const typedEnv = env as CloudflareEnv;

    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        503,
      );
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/pdf")) {
      return createErrorResponse(
        "Content-Type must be application/pdf",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (!contentLengthHeader) {
      return createErrorResponse("Content-Length header is required", ERROR_CODES.BAD_REQUEST, 411);
    }

    const contentLength = parseInt(contentLengthHeader, 10);
    if (Number.isNaN(contentLength) || contentLength <= 0) {
      return createErrorResponse("Invalid Content-Length header", ERROR_CODES.BAD_REQUEST, 400);
    }

    if (contentLength > MAX_FILE_SIZE) {
      return createErrorResponse(
        `File size exceeds limit (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB maximum)`,
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    if (contentLength < MIN_PDF_SIZE) {
      return createErrorResponse(
        "File appears to be empty or corrupted",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    const filename = request.headers.get("x-filename");
    if (!filename || !z.string().safeParse(filename).success || filename.trim().length === 0) {
      return createErrorResponse("X-Filename header is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    if (filename.length > 255) {
      return createErrorResponse(
        "Filename too long (max 255 characters)",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    const clientIP = getClientIP(request);

    const rateLimit = await checkIPRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return createErrorResponse(
        rateLimit.message || "Rate limit exceeded",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        { remaining: rateLimit.remaining },
      );
    }

    const reader = request.body?.getReader();
    if (!reader) {
      return createErrorResponse("Missing request body", ERROR_CODES.BAD_REQUEST, 400);
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.length;
      if (totalBytes > MAX_FILE_SIZE) {
        try {
          await reader.cancel();
        } catch {}
        return createErrorResponse(
          `File size exceeds limit (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB maximum)`,
          ERROR_CODES.BAD_REQUEST,
          413,
        );
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const ch of chunks) {
      combined.set(ch, offset);
      offset += ch.length;
    }
    // SAFETY: combined is Uint8Array; slice produces ArrayBuffer for validatePDFBuffer/R2 put.
    const buffer = combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ) as ArrayBuffer;

    if (totalBytes !== contentLength) {
      return createErrorResponse("Content-Length mismatch", ERROR_CODES.BAD_REQUEST, 400);
    }

    const pdfValidation = validatePDFBuffer(buffer);
    if (!pdfValidation.valid) {
      return createErrorResponse(
        pdfValidation.error || "Invalid PDF file",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    const key = generateTempKey(filename);

    try {
      await R2.put(r2Binding, key, buffer, {
        contentType: "application/pdf",
        customMetadata: {
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (r2Error) {
      console.error("R2 upload error:", r2Error);
      return createErrorResponse("Failed to store file", ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500);
    }

    // 10. Create signed cookie for claim verification (Issue #89)
    const cookieSecret = getOptionalEnvValue(typedEnv, "PENDING_UPLOAD_SECRET");
    let setCookieHeader: string | undefined;
    if (cookieSecret && z.string().safeParse(cookieSecret).success) {
      const signedCookieValue = await createSignedCookieValue(key, cookieSecret);
      setCookieHeader = `${COOKIE_NAME}=${signedCookieValue}; HttpOnly; SameSite=Strict; Max-Age=1800; Path=/`;
      if (typedEnv.NODE_ENV === "production") {
        setCookieHeader += "; Secure";
      }
    } else {
      console.warn("PENDING_UPLOAD_SECRET not configured - upload will not be claimable");
    }

    const response = createSuccessResponse({ key, remaining: rateLimit.remaining });
    response.headers.set("X-RateLimit-Remaining-Hourly", String(rateLimit.remaining.hourly));
    response.headers.set("X-RateLimit-Remaining-Daily", String(rateLimit.remaining.daily));
    if (setCookieHeader) {
      response.headers.set("Set-Cookie", setCookieHeader);
    }
    return response;
  } catch (error) {
    console.error("Error uploading file:", error);
    return createErrorResponse("Failed to upload file", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
