import type { UnknownRecord } from "@/lib/types/json";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import type { ERROR_CODES } from "@/lib/utils/security-headers";
import { z } from "zod";
import { ParseErrorType } from "@/lib/parse/error-types";

// Client code imports this module (hooks/useResumeStatus.ts, components/admin/AdminResumesClient.tsx),
// so it value-imports no `effect`, tagged error class or module that does; the build rejects one.

const MANUAL_MAX_RETRIES = 2;
const PARSE_MAX_ATTEMPTS = 4;

export const RETRY_LIMITS = {
  MANUAL_MAX_RETRIES,
  PARSE_MAX_ATTEMPTS,
  TOTAL_MAX_ATTEMPTS: PARSE_MAX_ATTEMPTS * (1 + MANUAL_MAX_RETRIES),
} as const;

export const PERMANENT_ERROR_TYPES = new Set<ParseErrorType>([
  ParseErrorType.INVALID_PDF,
  ParseErrorType.SERVICE_BINDING_NOT_FOUND,
  ParseErrorType.FILE_NOT_FOUND,
]);

export const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

export const WAITING_FOR_CACHE_TIMEOUT_MESSAGE =
  "Parsing timed out while waiting for cached result. Please try uploading again.";

/**
 * The stranded-row sweeper (`lib/cron/stranded-resumes.ts`) fails rows that stopped moving.
 * Both ages run from `COALESCE(queued_at, created_at)`: `queued_at` is stamped when the row is
 * queued (again on every manual retry) and again when a parse claims it. A swept row carries no
 * `last_attempt_error`, so `checkRetryEligibility` keeps it retryable.
 */
export const STRANDED_START_AFTER_MS = 15 * 60 * 1000;

export const STRANDED_PROCESSING_AFTER_MS = 90 * 60 * 1000;

export const STRANDED_START_MESSAGE = "Processing didn't start. Please try again.";

export const STRANDED_PROCESSING_MESSAGE = "Processing took too long. Please try again.";

export function hasExceededMaxAttempts(totalAttempts: number): boolean {
  return totalAttempts >= RETRY_LIMITS.TOTAL_MAX_ATTEMPTS;
}

export function isPermanentErrorType(errorType: string): errorType is ParseErrorType {
  // SAFETY: PERMANENT_ERROR_TYPES is Set<ParseErrorType>; cast narrows string for Set lookup, has() validates membership before type guard returns
  return PERMANENT_ERROR_TYPES.has(errorType as ParseErrorType);
}

const lastAttemptErrorSchema = z.object({ type: z.string() });

export function parseLastAttemptError(raw: string | null): { type: string } | null {
  if (!raw) return null;

  try {
    const parsed = lastAttemptErrorSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type ResumeRetryRow = {
  status: ResumeStatus;
  retryCount: number;
  totalAttempts: number;
  lastAttemptError?: string | null;
};

export type RetryEligibility =
  | { eligible: true; nextAttempt: number }
  | {
      eligible: false;
      reason: string;
      errorCode: keyof typeof ERROR_CODES;
      httpStatus: 400 | 429;
      details?: UnknownRecord;
    };

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

  const parsed = parseLastAttemptError(row.lastAttemptError ?? null);

  if (parsed?.type && isPermanentErrorType(parsed.type)) {
    return {
      eligible: false,
      reason: `This resume failed with a permanent error (${parsed.type}). Retrying will not help.`,
      errorCode: "VALIDATION_ERROR",
      httpStatus: 400,
      details: { error_type: parsed.type },
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

  if (row.retryCount >= RETRY_LIMITS.MANUAL_MAX_RETRIES) {
    return {
      eligible: false,
      reason: "Maximum retry limit reached. Please upload a new resume.",
      errorCode: "RATE_LIMIT_EXCEEDED",
      httpStatus: 429,
      details: {
        max_retries: RETRY_LIMITS.MANUAL_MAX_RETRIES,
        current_retry_count: row.retryCount,
      },
    };
  }

  return { eligible: true, nextAttempt: row.retryCount + 1 };
}

export type StatusRow = {
  status: ResumeStatus;
  createdAt: string | null;
};

export function waitingForCacheTimedOut(row: StatusRow): boolean {
  if (row.status !== "waiting_for_cache") return false;

  // null → epoch (0) → timed out (preserves legacy `new Date(null)` semantics:
  if (row.createdAt === null) return true;
  const ts = Date.parse(row.createdAt);

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

  return { publicStatus: row.status, progressPct: 0, isTerminal: false };
}

export type WaitingForCacheTimeoutUpdate = {
  status: "failed";
  errorMessage: string;
};

export function buildWaitingForCacheTimeoutUpdate(): WaitingForCacheTimeoutUpdate {
  return { status: "failed", errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE };
}

export type ResumeRow = StatusRow & ResumeRetryRow;

export function checkRetryEligibilityForRow(row: ResumeRow): RetryEligibility {
  if (waitingForCacheTimedOut(row)) {
    return checkRetryEligibility({
      status: "failed",
      retryCount: row.retryCount,
      totalAttempts: row.totalAttempts,
      lastAttemptError: null,
    });
  }

  return checkRetryEligibility(row);
}

export function getStatusView(row: ResumeRow) {
  const pres = statusPresentation(row);
  const isTimedOut = waitingForCacheTimedOut(row);
  const status: ResumeStatus = isTimedOut ? "failed" : pres.publicStatus;
  const canRetry = checkRetryEligibilityForRow(row).eligible;

  return {
    status,
    progressPct: pres.progressPct,
    isTimedOut,
    canRetry,
    waitingForCache: pres.waitingForCache ?? false,
    queued: pres.queued ?? false,
  };
}
