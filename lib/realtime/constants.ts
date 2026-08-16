import type { ResumeStatus } from "@/lib/db/schema/resume";

export const WS_MAX_RECONNECT_ATTEMPTS = 3;
export const WS_PING_INTERVAL_MS = 30000;
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_CAP_MS = 10000;
export const POLL_INTERVAL_MS = 3000;

export const RESUME_STATUSES: ReadonlySet<string> = new Set([
  "pending_claim",
  "queued",
  "processing",
  "completed",
  "failed",
  "waiting_for_cache",
]);

export function isValidResumeStatus(value: string): value is ResumeStatus {
  return RESUME_STATUSES.has(value);
}

export function shouldRetry(attempt: number): boolean {
  return attempt <= WS_MAX_RECONNECT_ATTEMPTS;
}

// Alias for callers that prefer the more explicit name
export const canRetryWS = shouldRetry;

export function getReconnectDelay(attempt: number): number {
  return Math.min(
    WS_RECONNECT_CAP_MS,
    WS_RECONNECT_BASE_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 200),
  );
}
