import { desc, eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { canRetryResume } from "@/lib/config/retry";
import { resumes } from "@/lib/db/schema";
import { createSuccessResponse } from "@/lib/utils/security-headers";

// Map pre-queue / in-flight statuses to the unified "processing" state so the
// wizard's initializeWizard() detects an ongoing parse and redirects to
// /waiting instead of falling through to the upload step (duplicate-upload
// path). Mirrors GET /api/resume/status.
function mapDisplayStatus(status: string): string {
  if (status === "queued" || status === "waiting_for_cache" || status === "pending_claim") {
    return "processing";
  }
  return status;
}

/**
 * GET /api/resume/latest-status
 * Get the latest resume status for the currently authenticated user.
 *
 * Response:
 *   {
 *     id: string,
 *     status: string,
 *     error: string | null,
 *     can_retry: boolean,
 *     createdAt: string
 *   } | null
 *
 * Error codes:
 *   - 500: unexpected error
 */
export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

      // Fetch the latest resume for the user.
      // Loads totalAttempts and lastAttemptError (in addition to the display
      // fields) so retry eligibility can be computed by the canonical
      // canRetryResume() rather than an inline rule -- keeping this endpoint a
      // mirror of GET /api/resume/status (see issue #174).
      const latestResume = await db
        .select({
          id: resumes.id,
          status: resumes.status,
          errorMessage: resumes.errorMessage,
          retryCount: resumes.retryCount,
          totalAttempts: resumes.totalAttempts,
          lastAttemptError: resumes.lastAttemptError,
          createdAt: resumes.createdAt,
        })
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .orderBy(desc(resumes.createdAt))
        .limit(1);

      if (!latestResume.length) {
        return createSuccessResponse(null);
      }

      const resume = latestResume[0];

      // Parse the stored last-attempt error to recover its type, matching the
      // status endpoint. canRetryResume() returns false for any non-failed status,
      // so this is safe to call unconditionally.
      let lastAttemptErrorType: string | null = null;
      if (resume.lastAttemptError) {
        try {
          lastAttemptErrorType =
            (JSON.parse(resume.lastAttemptError) as { type?: string }).type ?? null;
        } catch {
          lastAttemptErrorType = null;
        }
      }

      return createSuccessResponse({
        id: resume.id as string,
        status: mapDisplayStatus(resume.status),
        error: resume.errorMessage,
        can_retry: canRetryResume({
          status: resume.status,
          retryCount: resume.retryCount,
          totalAttempts: resume.totalAttempts,
          lastAttemptErrorType,
        }),
        createdAt: resume.createdAt as string,
      });
    },
    "You must be logged in to check resume status",
  );
}
