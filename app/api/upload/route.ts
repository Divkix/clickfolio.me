import { log, logEvent } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { z } from "zod";
import { RateLimited, RateLimitUnavailable } from "@/lib/api/errors";
import { runRoute } from "@/lib/api/route";
import { getR2Binding, R2 } from "@/lib/r2";
import { checkIPRateLimit, getClientIP, UPLOAD_UNAVAILABLE_MESSAGE } from "@/lib/rate-limit/ip";
import { getOptionalEnvValue } from "@/lib/utils/env";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createSignedCookieValue,
} from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { generateTempKey, MAX_FILE_SIZE, validatePDFBuffer } from "@/lib/utils/validation";

const MIN_PDF_SIZE = 100;

// The client percent-encodes X-Filename; an older client sends it raw.
function decodeFilenameHeader(value: string | null): string | null {
  if (value === null) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  return runRoute(
    request,
    Effect.gen(function* () {
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
        return createErrorResponse(
          "Content-Length header is required",
          ERROR_CODES.BAD_REQUEST,
          411,
        );
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

      const filename = decodeFilenameHeader(request.headers.get("x-filename"));

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

      const rateLimit = yield* Effect.promise(() => checkIPRateLimit(getClientIP(request)));

      if (rateLimit.unavailable) {
        return yield* new RateLimitUnavailable({
          message: rateLimit.message ?? UPLOAD_UNAVAILABLE_MESSAGE,
        });
      }

      if (!rateLimit.allowed) {
        return yield* new RateLimited({
          message: rateLimit.message ?? "Rate limit exceeded",
          details: { remaining: rateLimit.remaining },
        });
      }

      return yield* Effect.promise(() =>
        storeUpload(request, { r2Binding, typedEnv, filename, contentLength }, rateLimit.remaining),
      );
    }),
  );
}

interface CheckedUpload {
  r2Binding: R2Bucket;
  typedEnv: CloudflareEnv;
  filename: string;
  contentLength: number;
}

async function storeUpload(
  request: Request,
  { r2Binding, typedEnv, filename, contentLength }: CheckedUpload,
  remaining: { hourly: number; daily: number },
): Promise<Response> {
  try {
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
    const startedAt = Date.now();

    try {
      await R2.put(r2Binding, key, buffer, {
        contentType: "application/pdf",
        customMetadata: {
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (r2Error) {
      logEvent(
        "resume_upload_failed",
        { size_bytes: totalBytes, duration_ms: Date.now() - startedAt, ...errorFields(r2Error) },
        "error",
      );

      return createErrorResponse("Failed to store file", ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500);
    }

    logEvent("resume_uploaded", { size_bytes: totalBytes, duration_ms: Date.now() - startedAt });

    // Signed cookie for claim verification (Issue #89); /api/upload/pending refreshes it
    // for the wizard flow, so both writers must use the same attributes and max-age.
    const cookieSecret = getOptionalEnvValue(typedEnv, "PENDING_UPLOAD_SECRET");
    let setCookieHeader: string | undefined;

    if (cookieSecret && z.string().safeParse(cookieSecret).success) {
      const signedCookieValue = await createSignedCookieValue(key, cookieSecret);
      setCookieHeader = `${COOKIE_NAME}=${signedCookieValue}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`;

      if (typedEnv.NODE_ENV === "production") {
        setCookieHeader += "; Secure";
      }
    } else {
      log("warn", "PENDING_UPLOAD_SECRET not configured - upload will not be claimable");
    }

    const response = createSuccessResponse({ key, remaining });
    response.headers.set("X-RateLimit-Remaining-Hourly", String(remaining.hourly));
    response.headers.set("X-RateLimit-Remaining-Daily", String(remaining.daily));

    if (setCookieHeader) {
      response.headers.set("Set-Cookie", setCookieHeader);
    }

    return response;
  } catch (error) {
    log("error", "Error uploading file:", { ...errorFields(error) });

    return createErrorResponse("Failed to upload file", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
