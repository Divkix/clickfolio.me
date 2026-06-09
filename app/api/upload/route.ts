import { env } from "cloudflare:workers";
import { getR2Binding, R2 } from "@/lib/r2";
import { checkIPRateLimit, getClientIP } from "@/lib/rate-limit/ip";
import { COOKIE_NAME, createSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { generateTempKey, MAX_FILE_SIZE, validatePDFBuffer } from "@/lib/utils/validation";

// Minimum file size for a valid PDF (100 bytes)
const MIN_PDF_SIZE = 100;

/**
 * POST /api/upload
 * Direct file upload to R2 via Worker binding (replaces presigned URLs).
 *
 * Request headers:
 *   - Content-Type: application/pdf (required)
 *   - Content-Length: file size in bytes (required)
 *   - X-Filename: original filename (required)
 *
 * Rate limits:
 *   - 10 uploads per hour per IP
 *   - 50 uploads per day per IP
 *
 * Returns:
 *   - key: R2 object key (temp/{uuid}/{filename})
 *   - remaining: { hourly, daily } rate limit remaining
 *   - Set-Cookie: pending_upload cookie for claim verification
 *
 * Error codes:
 *   - 400: invalid Content-Type, missing/invalid Content-Length, empty file,
 *           filename too long, Content-Length mismatch, or invalid PDF
 *   - 411: missing Content-Length header
 *   - 413: file size exceeds MAX_FILE_SIZE
 *   - 429: rate limit exceeded (per IP)
 *   - 500: R2 storage error or unexpected error
 */
export async function POST(request: Request) {
  try {
    // 0. Get Cloudflare env bindings for R2
    const typedEnv = env as CloudflareEnv;

    // Get R2 binding for direct operations
    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        503,
      );
    }

    // 1. Validate Content-Type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/pdf")) {
      return createErrorResponse(
        "Content-Type must be application/pdf",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 2. Validate Content-Length before reading body
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

    // 3. Get filename from header
    const filename = request.headers.get("x-filename");
    if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
      return createErrorResponse("X-Filename header is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    if (filename.length > 255) {
      return createErrorResponse(
        "Filename too long (max 255 characters)",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 4. Extract client IP for rate limiting
    const clientIP = getClientIP(request);

    // 5. Check IP-based rate limit BEFORE any processing
    const rateLimit = await checkIPRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return createErrorResponse(
        rateLimit.message || "Rate limit exceeded",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        { remaining: rateLimit.remaining },
      );
    }

    // 6. Read the request body
    const buffer = await request.arrayBuffer();

    // Verify actual size matches Content-Length
    if (buffer.byteLength !== contentLength) {
      return createErrorResponse("Content-Length mismatch", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 7. Validate PDF magic number
    const pdfValidation = validatePDFBuffer(buffer);
    if (!pdfValidation.valid) {
      return createErrorResponse(
        pdfValidation.error || "Invalid PDF file",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 8. Generate temp key
    const key = generateTempKey(filename);

    // 9. Store to R2 via binding (hash computed at claim time for efficiency)
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
    const cookieSecret = typedEnv.BETTER_AUTH_SECRET;
    let setCookieHeader: string | undefined;
    if (cookieSecret && typeof cookieSecret === "string") {
      const signedCookieValue = await createSignedCookieValue(key, cookieSecret);
      // Set HttpOnly cookie (30 minute expiry, secure in production)
      setCookieHeader = `${COOKIE_NAME}=${signedCookieValue}; HttpOnly; SameSite=Strict; Max-Age=1800; Path=/`;
      if (typedEnv.NODE_ENV === "production") {
        setCookieHeader += "; Secure";
      }
    } else {
      console.warn("BETTER_AUTH_SECRET not configured - upload will not be claimable");
    }

    // 11. Return success with rate limit info and cookie
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
