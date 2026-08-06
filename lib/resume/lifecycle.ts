/**
 * Resume parse-lifecycle module — single owner of the resume state machine.
 *
 * Concentrates: retry eligibility, QueueError JSON shape, progress %
 * mapping, and the `waiting_for_cache` timeout predicate so callers
 * stop pre-parsing `lastAttemptError` and GET /status stops writing.
 *
 * `lib/config/retry.ts` re-exports this module for backwards compatibility.
 */

import { QueueErrorType } from "@/lib/queue/errors";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INFRA = {
  DLQ_NAME: "clickfolio-parse-dlq",
  DISPOSABLE_DOMAINS_KEY: "disposable-domains",
} as const;

export const RETRY_LIMITS = {
  MANUAL_MAX_RETRIES: 2,
  TOTAL_MAX_ATTEMPTS: 6,
} as const;

export const PERMANENT_ERROR_TYPES = [
  QueueErrorType.INVALID_PDF,
  QueueErrorType.MALFORMED_RESPONSE,
  QueueErrorType.SERVICE_BINDING_NOT_FOUND,
  QueueErrorType.FILE_NOT_FOUND,
  QueueErrorType.PARSE_VALIDATION_ERROR,
] as const;

export const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

export const WAITING_FOR_CACHE_TIMEOUT_MESSAGE =
  "Parsing timed out while waiting for cached result. Please try uploading again.";

// ---------------------------------------------------------------------------
// Low-level helpers (private-ish — exported for the compat shim only)
// ---------------------------------------------------------------------------

export function hasExceededMaxAttempts(totalAttempts: number): boolean {
  return totalAttempts >= RETRY_LIMITS.TOTAL_MAX_ATTEMPTS;
}

export function isPermanentErrorType(errorType: string): boolean {
  return (PERMANENT_ERROR_TYPES as readonly string[]).includes(errorType);
}

// ---------------------------------------------------------------------------
// QueueError JSON shape encapsulation
// ---------------------------------------------------------------------------

export type ParsedLastAttemptError = {
  type: string | null;
  message: string | null;
  isRetryable: boolean | null;
  raw: string | null;
  name?: string | null;
} | null;

/**
 * Parse the `resumes.lastAttemptError` text column, which stores
 * `JSON.stringify(classifyQueueError(error).toJSON())`.
 * One place that knows the storage shape — all callers pass the raw row
 * or the raw string (both supported for backwards compatibility).
 */
export function parseLastAttemptError(
  row: { lastAttemptError: string | null } | string | null,
): ParsedLastAttemptError {
  const raw = typeof row === "string" || row === null ? row : row.lastAttemptError;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      message?: string;
      isRetryable?: boolean;
      name?: string;
    };
    if (parsed && typeof parsed === "object") {
      return {
        type: typeof parsed.type === "string" ? parsed.type : null,
        message: typeof parsed.message === "string" ? parsed.message : null,
        isRetryable: typeof parsed.isRetryable === "boolean" ? parsed.isRetryable : null,
        raw,
        name: typeof parsed.name === "string" ? parsed.name : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getLastAttemptErrorType(
  row: { lastAttemptError: string | null } | string | null,
): string | null {
  return parseLastAttemptError(row)?.type ?? null;
}

// ---------------------------------------------------------------------------
// Retry eligibility
// ---------------------------------------------------------------------------

export type ResumeRetryRow = {
  status: string;
  retryCount: number;
  totalAttempts: number;
  lastAttemptError?: string | null;
  /** @deprecated — pass `lastAttemptError` (raw JSON string) instead */
  lastAttemptErrorType?: string | null;
};

export type RetryEligibility =
  | { eligible: true; nextAttempt: number }
  | {
      eligible: false;
      reason: string;
      errorCode: string;
      httpStatus: 400 | 429;
      details?: Record<string, unknown>;
    };

/**
 * Whether a resume is eligible for a manual retry.
 * Delegates to checkRetryEligibility so the 4 gates stay in one place.
 */
export function canRetryResume(row: ResumeRetryRow): boolean {
  return checkRetryEligibility(row).eligible;
}

/**
 * Discriminated eligibility check for `POST /api/resume/retry`.
 * Maps each gate to its HTTP status / error code so the route returns
 * without re-implementing the rules.
 */
export function checkRetryEligibility(row: ResumeRetryRow): RetryEligibility {
  if (hasExceededMaxAttempts(row.totalAttempts ?? 0)) {
    return {
      eligible: false,
      reason: "Maximum retry attempts exceeded. This resume cannot be retried.",
      errorCode: "RATE_LIMIT_EXCEEDED",
      httpStatus: 429,
      details: {
        max_attempts: RETRY_LIMITS.TOTAL_MAX_ATTEMPTS,
        current_attempts: row.totalAttempts,
      },
    };
  }

  // Back-compat: honour explicit `lastAttemptErrorType` if provided.
  // `undefined` = not provided → fall back to parsing lastAttemptError JSON.
  // `null` = explicitly no type → honour as null (do not fall back).
  const parsed =
    row.lastAttemptErrorType !== undefined
      ? row.lastAttemptErrorType
        ? { type: row.lastAttemptErrorType, message: null as string | null }
        : null
      : parseLastAttemptError(row.lastAttemptError ?? null);
  if (parsed?.type && isPermanentErrorType(parsed.type)) {
    return {
      eligible: false,
      reason: `This resume failed with a permanent error (${parsed.type}). Retrying will not help.`,
      errorCode: "VALIDATION_ERROR",
      httpStatus: 400,
      details: { error_type: parsed.type, error_message: parsed.message },
    };
  }

  if (row.status !== "failed") {
    return {
      eligible: false,
      reason: "Can only retry failed resumes",
      errorCode: "VALIDATION_ERROR",
      httpStatus: 400,
      details: { current_status: row.status },
    };
  }

  if ((row.retryCount as number) >= RETRY_LIMITS.MANUAL_MAX_RETRIES) {
    return {
      eligible: false,
      reason: "Maximum retry limit reached. Please upload a new resume.",
      errorCode: "RATE_LIMIT_EXCEEDED",
      httpStatus: 429,
      details: {
        max_retries: RETRY_LIMITS.MANUAL_MAX_RETRIES,
        current_retry_count: row.retryCount as number,
      },
    };
  }

  return { eligible: true, nextAttempt: (row.retryCount as number) + 1 };
}

// ---------------------------------------------------------------------------
// Presentation + waiting_for_cache timeout
// ---------------------------------------------------------------------------

export type StatusRow = {
  status: string;
  createdAt: string | null;
};

export function waitingForCacheTimedOut(row: StatusRow): boolean {
  if (row.status !== "waiting_for_cache") return false;
  // null → epoch (0) → timed out (preserves legacy `new Date(null)` semantics:
  // a row with no timestamp is treated as infinitely old)
  if (row.createdAt === null) return true;
  const ts = Date.parse(row.createdAt);
  // Invalid date string ("" or garbage) → NaN → not timed out (fail open:
  // don't clobber a row we can't date)
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > WAITING_FOR_CACHE_TIMEOUT_MS;
}

export type StatusPresentation = {
  publicStatus: string;
  progressPct: number;
  waitingForCache?: boolean;
  queued?: boolean;
  isTerminal: boolean;
  isWaitingForCacheTimeout?: boolean;
};

/**
 * Central progress-% + display-status mapping.
 * Covers pending_claim (15), queued (25), waiting_for_cache (30 or virtual failed),
 * processing (50), completed (100), failed (0).
 */
export function statusPresentation(row: StatusRow): StatusPresentation {
  if (row.status === "waiting_for_cache") {
    if (waitingForCacheTimedOut(row)) {
      return {
        publicStatus: "failed",
        progressPct: 0,
        isTerminal: true,
        isWaitingForCacheTimeout: true,
      };
    }
    return {
      publicStatus: "processing",
      progressPct: 30,
      waitingForCache: true,
      isTerminal: false,
    };
  }

  if (row.status === "pending_claim") {
    return { publicStatus: "processing", progressPct: 15, isTerminal: false };
  }

  if (row.status === "queued") {
    return { publicStatus: "processing", progressPct: 25, queued: true, isTerminal: false };
  }

  if (row.status === "completed") {
    return { publicStatus: "completed", progressPct: 100, isTerminal: true };
  }

  if (row.status === "failed") {
    return { publicStatus: "failed", progressPct: 0, isTerminal: true };
  }

  if (row.status === "processing") {
    return { publicStatus: "processing", progressPct: 50, isTerminal: false };
  }

  // Unknown status — treat as non-terminal with 0 progress
  return { publicStatus: row.status, progressPct: 0, isTerminal: false };
}

/**
 * Payload for the cron that persists the waiting_for_cache timeout.
 * Keeps the literal in one place with the predicate.
 */
export function buildWaitingForCacheTimeoutUpdate(): {
  status: "failed";
  errorMessage: string;
} {
  return { status: "failed", errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE };
}
