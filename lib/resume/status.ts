import type { ResumeStatus } from "@/lib/db/schema";

/**
 * Resume statuses that are pre-queue or in-flight. All of these are displayed to
 * users as the unified `"processing"` state so the wizard / waiting page keeps
 * polling instead of treating them as terminal. Shared by the status endpoints
 * (`/api/resume/status`, `/api/resume/latest-status`) so the membership set can't
 * drift between them — the two endpoints are asserted to agree by construction.
 */
export const PRE_QUEUE_STATUSES: ReadonlySet<ResumeStatus> = new Set([
  "pending_claim",
  "queued",
  "waiting_for_cache",
]);

/**
 * Map pre-queue / in-flight statuses to the unified `"processing"` display
 * state. Other statuses pass through unchanged.
 */
export function mapDisplayStatus(status: ResumeStatus): ResumeStatus {
  return PRE_QUEUE_STATUSES.has(status) ? "processing" : status;
}
