/**
 * Client-side resume upload helpers — shared by the homepage FileDropzone
 * and the wizard UploadStep.
 *
 * Uses XMLHttpRequest (not fetch) so we can report real byte-level upload
 * progress via `xhr.upload.onprogress`. The request still targets the same
 * `POST /api/upload` endpoint with the same headers/body the route expects.
 *
 * Also provides:
 * - `mapUploadError` — maps an upload failure to a specific, actionable
 *   user-facing message + a machine `error_reason` for PostHog.
 * - `uploadWithRetry` — wraps `uploadPdf` with exponential backoff, retrying
 *   only transient failures (network, 5xx, 429-after-wait). Permanent
 *   failures (invalid PDF, too large, expired) are not retried.
 */

import { setPendingUploadCookie } from "@/lib/utils/pending-upload-client";
import { MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";

/** Progress callback: receives 0–100 during the byte-upload phase. */
export type ProgressHandler = (percent: number) => void;

export interface UploadResult {
  key: string;
  remaining: { hourly: number; daily: number };
}

/** Machine-readable reason codes for PostHog `error_reason`. */
export type UploadErrorReason =
  | "invalid_pdf"
  | "too_large"
  | "rate_limited"
  | "missing_content_length"
  | "network"
  | "aborted"
  | "server"
  | "unknown";

export interface UploadError {
  reason: UploadErrorReason;
  /** Status code if available (undefined for network/abort). */
  status?: number;
  /** Specific, actionable user-facing message. */
  message: string;
  /** Whether retrying could plausibly succeed. */
  retryable: boolean;
}

interface UploadApiResponse {
  key: string;
  remaining: { hourly: number; daily: number };
  error?: string;
}

/**
 * Upload a PDF to /api/upload with real byte-level progress.
 *
 * On success, persists the pending-upload cookie (so the claim flow can
 * associate the temp file with the user after auth).
 */
export function uploadPdf(file: File, onProgress?: ProgressHandler): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);
    xhr.responseType = "json";
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("Content-Length", String(file.size));
    xhr.setRequestHeader("X-Filename", file.name);

    // Real byte-level upload progress
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };
      // Signal start
      xhr.upload.onloadstart = () => onProgress(0);
    }

    xhr.onload = () => {
      const status = xhr.status;
      const data = (xhr.response ?? {}) as UploadApiResponse;

      if (status >= 200 && status < 300) {
        if (!data.key) {
          reject(toUploadError(status, "Server returned no upload key"));
          return;
        }
        // Persist the claim cookie before resolving so the caller can claim.
        // A cookie-store failure is fatal to the flow (the upload can't be
        // claimed without it), so propagate it rather than masking a success.
        void setPendingUploadCookie(data.key)
          .then(() => resolve({ key: data.key, remaining: data.remaining }))
          .catch(() => {
            reject(toUploadError(status, "Failed to save pending upload"));
          });
        return;
      }

      reject(toUploadError(status, data.error));
    };

    xhr.onerror = () => {
      reject(toUploadError(undefined, "Network error"));
    };

    xhr.onabort = () => {
      reject(toUploadError(undefined, "Upload aborted", "aborted"));
    };

    xhr.ontimeout = () => {
      reject(toUploadError(undefined, "Upload timed out", "network"));
    };

    xhr.send(file);
  });
}

/**
 * Map an upload failure (status code + optional server message, or a thrown
 * UploadError) into a specific, actionable user-facing message + reason code.
 */
export function toUploadError(
  status: number | undefined,
  serverMessage?: string,
  fallbackReason?: UploadErrorReason,
): UploadError {
  // Already an UploadError-shaped object passed through
  if (typeof status === "undefined") {
    if (fallbackReason === "aborted") {
      return { reason: "aborted", message: "Upload cancelled.", retryable: false };
    }
    if (fallbackReason === "network") {
      return {
        reason: "network",
        message: "Network error — check your connection and try again.",
        retryable: true,
      };
    }
    // Generic network failure (onerror path)
    return {
      reason: "network",
      message: "Network error — check your connection and try again.",
      retryable: true,
    };
  }

  switch (status) {
    case 400:
      return {
        reason: "invalid_pdf",
        message:
          serverMessage?.includes("PDF") || serverMessage?.includes("empty")
            ? `${serverMessage}. Try a different file.`
            : "This doesn't look like a valid PDF. Try a different file.",
        retryable: false,
      };
    case 411:
      return {
        reason: "missing_content_length",
        message: "Upload failed — please try again.",
        retryable: true,
      };
    case 413:
      return {
        reason: "too_large",
        message: `File is too large (max ${MAX_FILE_SIZE_LABEL}). Try a smaller PDF.`,
        retryable: false,
      };
    case 429:
      return {
        reason: "rate_limited",
        message: serverMessage || "Upload limit reached (5 per day). Try again tomorrow.",
        retryable: false,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        reason: "server",
        message: "Our service hit a snag — please try again in a moment.",
        retryable: true,
      };
    default:
      return {
        reason: "unknown",
        message: serverMessage || "Something went wrong — please try a different file.",
        retryable: status >= 500,
      };
  }
}

export interface RetryOptions {
  /** Max retry attempts (default 3). */
  maxAttempts?: number;
  /** Base delay in ms (default 1000). */
  baseDelayMs?: number;
  /** Called with (attempt, delayMs) before each retry sleep. */
  onRetry?: (attempt: number, delayMs: number) => void;
  /** Progress handler forwarded to uploadPdf. */
  onProgress?: ProgressHandler;
  /** Optional abort signal to cancel the retry loop. */
  signal?: AbortSignal;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(toUploadError(undefined, "Upload aborted", "aborted"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(toUploadError(undefined, "Upload aborted", "aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Upload with exponential backoff. Retries ONLY transient failures
 * (network, server 5xx, 411). Permanent failures (invalid PDF, too large,
 * rate limited) throw immediately with the specific message.
 */
export async function uploadWithRetry(
  file: File,
  options: RetryOptions = {},
): Promise<UploadResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const { onRetry, onProgress, signal } = options;

  let lastError: UploadError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw toUploadError(undefined, "Upload aborted", "aborted");
    }
    try {
      return await uploadPdf(file, onProgress);
    } catch (err) {
      lastError = err as UploadError;

      // Don't retry permanent failures
      if (!lastError.retryable) {
        throw lastError;
      }

      // No attempts left
      if (attempt + 1 >= maxAttempts) {
        throw lastError;
      }

      // Exponential backoff with jitter: base * 2^attempt + 0–250ms jitter
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      onRetry?.(attempt + 1, delay);
      await sleep(delay, signal);
    }
  }

  // Should be unreachable, but satisfy the type checker.
  throw lastError ?? toUploadError(undefined, "Upload failed");
}
