/**
 * @deprecated — import from `@/lib/resume/lifecycle` directly.
 * This file is kept for backwards compatibility and re-exports the
 * canonical lifecycle module. New code should import from
 * `@/lib/resume/lifecycle`.
 */
export {
  INFRA,
  RETRY_LIMITS,
  PERMANENT_ERROR_TYPES,
  WAITING_FOR_CACHE_TIMEOUT_MS,
  WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
  hasExceededMaxAttempts,
  isPermanentErrorType,
  canRetryResume,
  checkRetryEligibility,
  parseLastAttemptError,
  getLastAttemptErrorType,
  waitingForCacheTimedOut,
  statusPresentation,
  buildWaitingForCacheTimeoutUpdate,
} from "../resume/lifecycle";
export type {
  ParsedLastAttemptError,
  ResumeRetryRow,
  RetryEligibility,
  StatusRow,
  StatusPresentation,
} from "../resume/lifecycle";
