import { desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { withUserEffect } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { getStatusView, WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export async function GET(request?: Request) {
  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const userId = authUser.id;

        // Single owner for presentation is getStatusView (lib/resume/lifecycle); keep wire shape, not logic, here.
        const latestResume = yield* Db.use((service) =>
          service.query("resume.latest-status", (db) =>
            db
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
              .limit(1),
          ),
        );

        if (!latestResume.length) {
          return createSuccessResponse(null);
        }

        const resume = latestResume[0];

        const view = getStatusView({
          status: resume.status,
          createdAt: resume.createdAt,
          retryCount: resume.retryCount,
          totalAttempts: resume.totalAttempts,
          lastAttemptError: resume.lastAttemptError,
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
      }),
    "You must be logged in to check resume status",
  );
}
