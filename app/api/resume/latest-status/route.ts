import { desc, eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { getStatusView, WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import { createSuccessResponse } from "@/lib/utils/security-headers";
export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

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

      // SAFETY: drizzle row fields are nullable; cast narrows to lifecycle helper type
      const view = getStatusView({
        status: resume.status as ResumeStatus,
        createdAt: resume.createdAt as string | null,
        retryCount: resume.retryCount as number,
        totalAttempts: resume.totalAttempts as number,
        lastAttemptError: resume.lastAttemptError as string | null,
      });
      // SAFETY: errorMessage is a nullable string column; cast bridges Drizzle type.
      const error = view.isTimedOut
        ? WAITING_FOR_CACHE_TIMEOUT_MESSAGE
        : (resume.errorMessage as string | null);

      // SAFETY: id and createdAt are validated string columns; casts bridge Drizzle nullable type.
      return createSuccessResponse({
        id: resume.id as string,
        status: view.status,
        error,
        can_retry: view.canRetry,
        createdAt: resume.createdAt as string,
      });
    },
    "You must be logged in to check resume status",
  );
}
