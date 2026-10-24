import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { InvalidInput } from "@/lib/effect/failures";
import { R2Store } from "@/lib/effect/services/r2-store";
import { checkIPRateLimitEffect, getClientIP } from "@/lib/rate-limit/ip";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { errorFields } from "@/lib/utils/error-fields";
import { log, logEvent } from "@/lib/utils/log";
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

const FILE_TOO_LARGE = `File size exceeds limit (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB maximum)`;

// The client percent-encodes X-Filename; an older client sends it raw.
function decodeFilenameHeader(value: string | null): string | null {
  if (value === null) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type UploadHeaders = { contentLength: number; filename: string };

/** Everything the headers can refuse, before any dependency is touched. */
function inspectHeaders(request: Request): UploadHeaders | Response {
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
    return createErrorResponse(FILE_TOO_LARGE, ERROR_CODES.BAD_REQUEST, 413);
  }

  if (contentLength < MIN_PDF_SIZE) {
    return createErrorResponse(
      "File appears to be empty or corrupted",
      ERROR_CODES.BAD_REQUEST,
      400,
    );
  }

  const filename = decodeFilenameHeader(request.headers.get("x-filename"));

  if (!filename || filename.trim().length === 0) {
    return createErrorResponse("X-Filename header is required", ERROR_CODES.BAD_REQUEST, 400);
  }

  if (filename.length > 255) {
    return createErrorResponse(
      "Filename too long (max 255 characters)",
      ERROR_CODES.BAD_REQUEST,
      400,
    );
  }

  return { contentLength, filename };
}

type UploadBody = { buffer: ArrayBuffer; totalBytes: number } | Response;

/** Streams the body, stopping as soon as it passes the size limit. */
async function readUploadBody(request: Request, contentLength: number): Promise<UploadBody> {
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
      await reader.cancel().catch((error) => {
        log("warn", "upload body cancel failed", { ...errorFields(error) });
      });

      return createErrorResponse(FILE_TOO_LARGE, ERROR_CODES.BAD_REQUEST, 413);
    }

    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const ch of chunks) {
    combined.set(ch, offset);
    offset += ch.length;
  }

  if (totalBytes !== contentLength) {
    return createErrorResponse("Content-Length mismatch", ERROR_CODES.BAD_REQUEST, 400);
  }

  // SAFETY: combined is Uint8Array; slice produces ArrayBuffer for validatePDFBuffer/R2 put.
  const buffer = combined.buffer.slice(
    combined.byteOffset,
    combined.byteOffset + combined.byteLength,
  ) as ArrayBuffer;

  return { buffer, totalBytes };
}

const COOKIE_UNSIGNED_WARNING =
  "PENDING_UPLOAD_SECRET not configured - upload will not be claimable";

// Signed cookie for claim verification (Issue #89); /api/upload/pending refreshes it
// for the wizard flow, so both writers must use the same attributes and max-age.
function pendingUploadCookieHeader(key: string): Effect.Effect<string | null> {
  const secret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");

  if (!secret) {
    log("warn", COOKIE_UNSIGNED_WARNING);

    return Effect.succeed(null);
  }

  return Effect.promise(() => createSignedCookieValue(key, secret)).pipe(
    Effect.map((signed) => {
      const header = `${COOKIE_NAME}=${signed}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`;

      return env.NODE_ENV === "production" ? `${header}; Secure` : header;
    }),
  );
}

function upload(request: Request) {
  return Effect.gen(function* () {
    const headers = inspectHeaders(request);

    if (headers instanceof Response) return headers;

    const rateLimit = yield* checkIPRateLimitEffect(getClientIP(request));

    const body = yield* Effect.tryPromise({
      try: () => readUploadBody(request, headers.contentLength),
      // The client went away mid-upload. Keep the cause: it is what `logFailure` logs, and the
      // visitor only sees the fixed message.
      catch: (cause) => new InvalidInput({ message: "Could not read the upload", cause }),
    });

    if (body instanceof Response) return body;

    const pdfValidation = validatePDFBuffer(body.buffer);

    if (!pdfValidation.valid) {
      return createErrorResponse(
        pdfValidation.error || "Invalid PDF file",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    const key = generateTempKey(headers.filename);
    const startedAt = Date.now();
    const store = yield* R2Store;

    // Never retried: a timed-out put may still land, and the temp/ lifecycle rule expires it.
    yield* store
      .put(key, body.buffer, {
        contentType: "application/pdf",
        customMetadata: {
          originalFilename: headers.filename,
          uploadedAt: new Date().toISOString(),
        },
      })
      .pipe(
        Effect.tapError((failure) =>
          Effect.sync(() =>
            logEvent(
              "resume_upload_failed",
              {
                size_bytes: body.totalBytes,
                duration_ms: Date.now() - startedAt,
                ...errorFields(failure.cause ?? failure),
              },
              "error",
            ),
          ),
        ),
      );

    logEvent("resume_uploaded", {
      size_bytes: body.totalBytes,
      duration_ms: Date.now() - startedAt,
    });

    const setCookieHeader = yield* pendingUploadCookieHeader(key);

    const response = createSuccessResponse({ key, remaining: rateLimit.remaining });
    response.headers.set("X-RateLimit-Remaining-Hourly", String(rateLimit.remaining.hourly));
    response.headers.set("X-RateLimit-Remaining-Daily", String(rateLimit.remaining.daily));

    if (setCookieHeader) {
      response.headers.set("Set-Cookie", setCookieHeader);
    }

    return response;
  });
}

export async function POST(request: Request) {
  // Checked first so a missing bucket does not burn the visitor's upload quota.
  if (!env.CLICKFOLIO_R2_BUCKET) {
    return createErrorResponse(
      "Storage service unavailable",
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      503,
    );
  }

  return runRoute(
    request,
    upload(request),
    Layer.mergeAll(Db.layer(env.HYPERDRIVE), R2Store.layer(env)),
  );
}
