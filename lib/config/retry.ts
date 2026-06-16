/**
 * Infrastructure binding / queue name constants
 * Single source of truth — avoids magic string duplication across worker/cron/email.
 */
export const INFRA = {
  /** Dead-letter queue name (must match wrangler.jsonc dead_letter_queue) */
  DLQ_NAME: "clickfolio-parse-dlq",
  /** KV key used to store/fetch the disposable domains list */
  DISPOSABLE_DOMAINS_KEY: "disposable-domains",
} as const;

/**
 * Unified retry limits configuration
 *
 * These limits apply across all retry mechanisms:
 * - Cloudflare Queue automatic retries
 * - Manual retries via /api/resume/retry
 * - Orphan recovery cron
 */
export const RETRY_LIMITS = {
  /** Max manual retries via /api/resume/retry */
  MANUAL_MAX_RETRIES: 2,

  /** Total max attempts across all mechanisms */
  TOTAL_MAX_ATTEMPTS: 6,
} as const;

/**
 * Error types that should NOT be retried (permanent failures)
 */
export const PERMANENT_ERROR_TYPES = [
  "invalid_pdf",
  "malformed_response",
  "service_binding_not_found",
  "file_not_found",
  "parse_validation_error",
] as const;

/**
 * Check if a resume has exceeded total retry attempts
 */
export function hasExceededMaxAttempts(totalAttempts: number): boolean {
  return totalAttempts >= RETRY_LIMITS.TOTAL_MAX_ATTEMPTS;
}

/**
 * Check if an error type is permanent (should not retry)
 */
export function isPermanentErrorType(errorType: string): boolean {
  return PERMANENT_ERROR_TYPES.includes(errorType as (typeof PERMANENT_ERROR_TYPES)[number]);
}

/**
 * Whether a resume is eligible for a manual retry. Mirrors the checks enforced
 * by POST /api/resume/retry so the status endpoint's `can_retry` flag never
 * advertises a retry the retry route will reject.
 */
export function canRetryResume(input: {
  status: string;
  retryCount: number;
  totalAttempts: number;
  lastAttemptErrorType?: string | null;
}): boolean {
  if (input.status !== "failed") return false;
  if (hasExceededMaxAttempts(input.totalAttempts)) return false;
  if (input.retryCount >= RETRY_LIMITS.MANUAL_MAX_RETRIES) return false;
  if (input.lastAttemptErrorType && isPermanentErrorType(input.lastAttemptErrorType)) {
    return false;
  }
  return true;
}
