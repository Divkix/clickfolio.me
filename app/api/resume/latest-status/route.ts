import { desc, eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { canRetryResume } from "@/lib/config/retry";
import { resumes } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

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
export async function GET() {
  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to check resume status");
    if (authError) return authError;

    // 2. Use the db from auth validation (already connected with primary-first consistency)
    const userId = authUser.id;

    // 3. Fetch the latest resume for the user.
    //    Loads totalAttempts and lastAttemptError (in addition to the display
    //    fields) so retry eligibility can be computed by the canonical
    //    canRetryResume() rather than an inline rule -- keeping this endpoint a
    //    mirror of GET /api/resume/status (see issue #174).
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
      status: resume.status,
      error: resume.errorMessage,
      can_retry: canRetryResume({
        status: resume.status,
        retryCount: resume.retryCount,
        totalAttempts: resume.totalAttempts,
        lastAttemptErrorType,
      }),
      createdAt: resume.createdAt as string,
    });
  } catch (err) {
    console.error("Error fetching latest resume status:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
