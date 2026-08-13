import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import type { UnknownRecord } from "@/lib/types/json";
import {
  canRetryResume,
  statusPresentation,
  WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
} from "@/lib/resume/lifecycle";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/resume/status
 * Lightweight polling endpoint for resume parsing status.
 *
 * Query parameter:
 *   - resume_id: string (required)
 *
 * Status states:
 *   - waiting_for_cache: 10-minute timeout, then transitions to failed
 *   - queued: shown as processing with early progress (25%)
 *   - pending_claim: shown as processing with earliest progress (15%)
 *   - processing: intermediate progress (50%)
 *   - completed: includes parsed_content JSON
 *   - failed: includes error message and can_retry flag
 *
 * Response fields vary by status:
 *   - progress_pct: number (0-100)
 *   - error: string | null
 *   - can_retry: boolean (true when the resume is actually retry-eligible; see canRetryResume)
 *   - parsed_content: object | null (only when completed)
 *   - waiting_for_cache: boolean (only when waiting)
 *   - queued: boolean (only when queued)
 *
 * Error codes:
 *   - 400: missing resume_id
 *   - 403: resume belongs to another user
 *   - 404: resume not found
 *   - 500: unexpected error or invalid stored JSON
 */
export async function GET(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

      // Get resume_id from query params
      const { searchParams } = new URL(request.url);
      const resumeId = searchParams.get("resume_id");

      if (!resumeId) {
        return createErrorResponse("resume_id parameter is required", ERROR_CODES.BAD_REQUEST, 400);
      }

      // Fetch resume from database -- lightweight polling query
      // Only select columns needed for status checks. Excludes parsedContent
      // and parsedContentStaged (10-100KB JSON blobs) to avoid transferring
      // them on every 3-second poll.
      const resume = await db.query.resumes.findFirst({
        where: eq(resumes.id, resumeId),
        columns: {
          id: true,
          userId: true,
          status: true,
          errorMessage: true,
          retryCount: true,
          totalAttempts: true,
          lastAttemptError: true,
          createdAt: true,
        },
      });

      if (!resume) {
        return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
      }

      // Verify ownership
      if (resume.userId !== userId) {
        return createErrorResponse(
          "You do not have permission to access this resume",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }

      // Side-effect-free waiting_for_cache timeout: present as failed virtually.
      // The DB row stays `waiting_for_cache` until the orphan cron persists the
      // timeout (lib/cron/recover-orphaned). No `db.update` / `captureBookmark` here.
      // SAFETY: D1 status and createdAt are validated enum/string columns; casts bridge Drizzle nullable type.
      // Compute presentation once — it already encodes the timeout predicate.
      const presForTimeout = statusPresentation({
        status: resume.status as string,
        createdAt: resume.createdAt as string | null,
      });
      if (presForTimeout.isWaitingForCacheTimeout) {
        return createSuccessResponse({
          status: "failed",
          progress_pct: 0,
          error: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
          can_retry: canRetryResume({
            status: "failed",
            retryCount: resume.retryCount,
            totalAttempts: resume.totalAttempts,
            lastAttemptError: null,
          }),
        });
      }

      if (resume.status === "completed") {
        // Only fetch parsedContent when we actually need it (status is completed).
        // This second query is a one-time cost on completion, not repeated every poll.
        const resumeContent = await db.query.resumes.findFirst({
          where: eq(resumes.id, resumeId),
          columns: {
            parsedContent: true,
          },
        });

        // SAFETY: D1 parsedContent is nullable text column validated via resumeContentSchema; cast bridges nullable to string|null.
        const parsedContent = (resumeContent?.parsedContent as string | null) ?? null;
        let parsedJson: UnknownRecord | null = null;

        if (parsedContent) {
          try {
            // SAFETY: parsedContent is JSON string from D1 validated on write via resumeContentSchema; parsing to UnknownRecord is safe, failure is caught and returns 500.
            parsedJson = JSON.parse(parsedContent) as UnknownRecord;
          } catch (error) {
            console.error("Failed to parse stored resume JSON:", error);
            return createErrorResponse(
              "Stored resume data is invalid",
              ERROR_CODES.INTERNAL_ERROR,
              500,
            );
          }
        }

        return createSuccessResponse({
          status: "completed",
          progress_pct: 100,
          error: null,
          can_retry: false,
          parsed_content: parsedJson,
        });
      }

      if (resume.status === "failed") {
        return createSuccessResponse({
          status: "failed",
          progress_pct: 0,
          error: resume.errorMessage ?? null,
          can_retry: canRetryResume({
            status: resume.status,
            retryCount: resume.retryCount,
            totalAttempts: resume.totalAttempts,
            lastAttemptError: resume.lastAttemptError,
          }),
        });
      }

      // Unified presentation for pre-queue / in-flight / unknown statuses.
      // Reuse the single presentation computed above (already encodes timeout).
      const pres = presForTimeout;

      if (pres.publicStatus === "processing") {
        const extra: UnknownRecord = {};
        if (pres.waitingForCache) extra.waiting_for_cache = true;
        if (pres.queued) extra.queued = true;
        return createSuccessResponse({
          status: "processing",
          progress_pct: pres.progressPct,
          error: null,
          can_retry: false,
          ...extra,
        });
      }

      // Unknown / non-processing terminal fallback (should not happen for known enum)
      return createSuccessResponse({
        status: pres.publicStatus,
        progress_pct: pres.progressPct,
        error: resume.errorMessage ?? null,
        can_retry: false,
      });
    },
    "You must be logged in to check resume status",
  );
}
