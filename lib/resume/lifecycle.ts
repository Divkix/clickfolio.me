/**
 * Resume parse-lifecycle module — single owner of the resume state machine.
 *
 * Concentrates: retry eligibility, QueueError JSON shape, progress %
 * mapping, and the `waiting_for_cache` timeout predicate so callers
 * stop pre-parsing `lastAttemptError` and GET /status stops writing.
 */

import type { JsonValue, UnknownRecord } from "@/lib/types/json";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { z } from "zod";
import { QueueErrorType } from "@/lib/queue/errors";

function isString(value: JsonValue): value is string {
  return z.string().safeParse(value).success;
}
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

export const PERMANENT_ERROR_TYPES = new Set<QueueErrorType>([
  QueueErrorType.INVALID_PDF,
  QueueErrorType.MALFORMED_RESPONSE,
  QueueErrorType.SERVICE_BINDING_NOT_FOUND,
  QueueErrorType.FILE_NOT_FOUND,
  QueueErrorType.PARSE_VALIDATION_ERROR,
]);

export const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

export const WAITING_FOR_CACHE_TIMEOUT_MESSAGE =
  "Parsing timed out while waiting for cached result. Please try uploading again.";

// ---------------------------------------------------------------------------
// Low-level helpers (private-ish — exported for the compat shim only)
// ---------------------------------------------------------------------------

export function hasExceededMaxAttempts(totalAttempts: number): boolean {
  return totalAttempts >= RETRY_LIMITS.TOTAL_MAX_ATTEMPTS;
}

export function isPermanentErrorType(errorType: string): errorType is QueueErrorType {
  // SAFETY: PERMANENT_ERROR_TYPES is Set<QueueErrorType>; cast narrows string for Set lookup, has() validates membership before type guard returns
  return PERMANENT_ERROR_TYPES.has(errorType as QueueErrorType);
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
  let raw: string | null;
  if (row === null || isString(row)) {
    // SAFETY: isString guard above ensures row is string; null check handles null case.
    raw = row as string | null;
  } else {
    raw = row.lastAttemptError;
  }
  if (!raw) return null;
  try {
    // SAFETY: QueueError JSON is from classifyQueueError().toJSON() validated at write; parse failure falls back to unknown.
    const parsed = JSON.parse(raw) as {
      type?: string;
      message?: string;
      isRetryable?: boolean;
      name?: string;
    };
    if (parsed != null && parsed instanceof Object) {
      // SAFETY: parsed is non-null object from JSON.parse validated via instanceof Object; Record<string, JsonValue> is safe for queue error fields.
      const record = parsed as Record<string, JsonValue>;
      return {
        // SAFETY: z.string guard above ensures record.type is string when present.
        type: z.string().safeParse(record.type).success ? (record.type as string) : null,
        // SAFETY: z.string guard above ensures record.message is string when present.
        message: z.string().safeParse(record.message).success ? (record.message as string) : null,
        // SAFETY: z.boolean guard above ensures record.isRetryable is boolean when present.
        isRetryable: z.boolean().safeParse(record.isRetryable).success
          ? (record.isRetryable as boolean)
          : null,
        raw,
        // SAFETY: z.string guard above ensures record.name is string when present.
        name: z.string().safeParse(record.name).success ? (record.name as string) : null,
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
  status: ResumeStatus;
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
      details?: UnknownRecord;
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
  // SAFETY: lifecycle.parseLastAttemptError validates QueueError JSON shape before cast.
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

  // SAFETY: Drizzle infers retryCount as number|null; row is existing resume with non-null retryCount, safe to narrow to number.
  if ((row.retryCount as number) >= RETRY_LIMITS.MANUAL_MAX_RETRIES) {
    // SAFETY: Drizzle infers retryCount as number|null; safe to narrow for retry count display.
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

  // SAFETY: Drizzle infers retryCount as number|null; row is existing resume with non-null retryCount, safe to narrow for nextAttempt.
  return { eligible: true, nextAttempt: (row.retryCount as number) + 1 };
}

// ---------------------------------------------------------------------------
// Presentation + waiting_for_cache timeout
// ---------------------------------------------------------------------------

export type StatusRow = {
  status: ResumeStatus;
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
  publicStatus: ResumeStatus;
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
export type WaitingForCacheTimeoutUpdate = {
  status: "failed";
  errorMessage: string;
};

export function buildWaitingForCacheTimeoutUpdate(): WaitingForCacheTimeoutUpdate {
  return { status: "failed", errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE };
}

// ---------------------------------------------------------------------------
// Unified status view — single call that encodes timeout + presentation + retry
// ---------------------------------------------------------------------------

export type ResumeRow = StatusRow & ResumeRetryRow;
export function getStatusView(row: ResumeRow) {
  const pres = statusPresentation(row);
  const isTimedOut = waitingForCacheTimedOut(row);
  const status: ResumeStatus = isTimedOut ? "failed" : pres.publicStatus;
  const canRetry = isTimedOut
    ? canRetryResume({
        status: "failed",
        retryCount: row.retryCount,
        totalAttempts: row.totalAttempts,
        lastAttemptError: null,
      })
    : canRetryResume(row);
  return { status, progressPct: pres.progressPct, isTimedOut, canRetry };
}
