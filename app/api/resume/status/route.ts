import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import type { UnknownRecord } from "@/lib/types/json";
import { getStatusView, WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

      const { searchParams } = new URL(request.url);
      const resumeId = searchParams.get("resume_id");

      if (!resumeId) {
        return createErrorResponse("resume_id parameter is required", ERROR_CODES.BAD_REQUEST, 400);
      }

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

      if (resume.userId !== userId) {
        return createErrorResponse(
          "You do not have permission to access this resume",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
      // The DB row stays `waiting_for_cache` until the orphan cron persists the
      // timeout (lib/cron/recover-orphaned). No `db.update` here.
      // SAFETY: drizzle row fields are string/number but getStatusView expects exact types; casts narrow Drizzle-inferred types for lifecycle helper
      const view = getStatusView({
        status: resume.status as ResumeStatus,
        createdAt: resume.createdAt as string | null,
        retryCount: resume.retryCount as number,
        totalAttempts: resume.totalAttempts as number,
        lastAttemptError: resume.lastAttemptError as string | null,
      });
      if (view.isTimedOut) {
        return createSuccessResponse({
          status: view.status,
          progress_pct: view.progressPct,
          error: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
          can_retry: view.canRetry,
        });
      }

      if (view.status === "completed") {
        const resumeContent = await db.query.resumes.findFirst({
          where: eq(resumes.id, resumeId),
          columns: {
            parsedContent: true,
          },
        });

        // SAFETY: parsedContent is schema-validated JSONB written by our queue consumer; cast bridges the column's wide Record type.
        const parsedJson = (resumeContent?.parsedContent as UnknownRecord | null) ?? null;

        return createSuccessResponse({
          status: "completed",
          progress_pct: 100,
          error: null,
          can_retry: false,
          parsed_content: parsedJson,
        });
      }

      if (view.status === "failed") {
        return createSuccessResponse({
          status: view.status,
          progress_pct: view.progressPct,
          error: resume.errorMessage ?? null,
          can_retry: view.canRetry,
        });
      }

      if (view.status === "processing") {
        const extra: UnknownRecord = {};
        if (view.waitingForCache) extra.waiting_for_cache = true;
        if (view.queued) extra.queued = true;
        return createSuccessResponse({
          status: view.status,
          progress_pct: view.progressPct,
          error: null,
          can_retry: false,
          ...extra,
        });
      }

      return createSuccessResponse({
        status: view.status,
        progress_pct: view.progressPct,
        error: resume.errorMessage ?? null,
        can_retry: false,
      });
    },
    "You must be logged in to check resume status",
  );
}
