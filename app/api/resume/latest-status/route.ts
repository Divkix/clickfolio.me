import { desc, eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { createSuccessResponse } from "@/lib/utils/security-headers";

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

      // Fetch the latest resume for the user
      const latestResume = await db
        .select({
          id: resumes.id,
          status: resumes.status,
          errorMessage: resumes.errorMessage,
          retryCount: resumes.retryCount,
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

      return createSuccessResponse({
        id: resume.id as string,
        status: resume.status,
        error: resume.errorMessage,
        can_retry: resume.status === "failed" && (resume.retryCount as number) < 2,
        createdAt: resume.createdAt as string,
      });
    },
    "You must be logged in to check resume status",
  );
}
