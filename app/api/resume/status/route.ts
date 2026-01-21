import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { resumes } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

// 10 minute timeout for waiting_for_cache status
const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to check resume status",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    // 3. Get resume_id from query params
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get("resume_id");

    if (!resumeId) {
      return createErrorResponse("resume_id parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 4. Fetch resume from database (include fileHash for fan-out)
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resumeId),
    });

    if (!resume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }

    // 5. Verify ownership
    if (resume.userId !== userId) {
      return createErrorResponse(
        "You do not have permission to access this resume",
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    // 6. Handle waiting_for_cache status with timeout check
    if (resume.status === "waiting_for_cache") {
      const createdAt = new Date(resume.createdAt as string);
      const waitingTime = Date.now() - createdAt.getTime();

      if (waitingTime > WAITING_FOR_CACHE_TIMEOUT_MS) {
        // Timeout reached - transition to failed status
        await db
          .update(resumes)
          .set({
            status: "failed",
            errorMessage:
              "Parsing timed out while waiting for cached result. Please try uploading again.",
          })
          .where(eq(resumes.id, resumeId));

        await captureBookmark();
        return createSuccessResponse({
          status: "failed",
          progress_pct: 0,
          error: "Parsing timed out while waiting for cached result. Please try uploading again.",
          can_retry: (resume.retryCount as number) < 2,
        });
      }

      // Still within timeout - return processing status to keep polling
      return createSuccessResponse({
        status: "processing",
        progress_pct: 30,
        error: null,
        can_retry: false,
        waiting_for_cache: true,
      });
    }

    const buildCompletedResponse = (parsedContent: string | null) => {
      let parsedJson: unknown = null;

      if (parsedContent) {
        try {
          parsedJson = JSON.parse(parsedContent) as Record<string, unknown>;
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
    };

    if (resume.status === "completed") {
      return buildCompletedResponse((resume.parsedContent as string | null) ?? null);
    }

    if (resume.status === "failed") {
      return createSuccessResponse({
        status: "failed",
        progress_pct: 0,
        error: (resume.errorMessage as string | undefined | null) ?? null,
        can_retry: (resume.retryCount as number) < 2,
      });
    }

    if (resume.status !== "processing") {
      return createSuccessResponse({
        status: resume.status,
        progress_pct: 0,
        error: resume.errorMessage ?? null,
        can_retry: false,
      });
    }

    const backgroundTaskId =
      (resume as { backgroundTaskId?: string | null }).backgroundTaskId ?? null;

    if (!backgroundTaskId) {
      return createSuccessResponse({
        status: "processing",
        progress_pct: 50,
        error: null,
        can_retry: false,
      });
    }

    const latestResume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resumeId),
      columns: {
        status: true,
        parsedContent: true,
        errorMessage: true,
        retryCount: true,
      },
    });

    if (!latestResume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }

    if (latestResume.status === "completed") {
      return buildCompletedResponse((latestResume.parsedContent as string | null) ?? null);
    }

    if (latestResume.status === "failed") {
      return createSuccessResponse({
        status: "failed",
        progress_pct: 0,
        error: latestResume.errorMessage ?? null,
        can_retry: (latestResume.retryCount as number) < 2,
      });
    }

    return createSuccessResponse({
      status: "processing",
      progress_pct: 50,
      error: null,
      can_retry: false,
    });
  } catch (error) {
    console.error("Error checking resume status:", error);
    return createErrorResponse(
      "An unexpected error occurred while checking status",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
