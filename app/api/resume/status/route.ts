import { and, eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { canRetryResume } from "@/lib/config/retry";
import { resumes } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

// 10 minute timeout for waiting_for_cache status
const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000;

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
  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to check resume status");
    if (authError) return authError;

    const userId = authUser.id;

    // 2. Get resume_id from query params
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get("resume_id");

    if (!resumeId) {
      return createErrorResponse("resume_id parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 3. Fetch resume from database -- lightweight polling query
    //    Only select columns needed for status checks. Excludes parsedContent
    //    and parsedContentStaged (10-100KB JSON blobs) to avoid transferring
    //    them on every 3-second poll.
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

    // 4. Verify ownership
    if (resume.userId !== userId) {
      return createErrorResponse(
        "You do not have permission to access this resume",
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    // 5. Handle waiting_for_cache status with timeout check
    if (resume.status === "waiting_for_cache") {
      const createdAt = new Date(resume.createdAt);
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
          .where(and(eq(resumes.id, resumeId), eq(resumes.status, "waiting_for_cache")));

        await captureBookmark();
        return createSuccessResponse({
          status: "failed",
          progress_pct: 0,
          error: "Parsing timed out while waiting for cached result. Please try uploading again.",
          can_retry: canRetryResume({
            // Row was just transitioned to "failed"; in-memory status is still
            // "waiting_for_cache", so pass "failed" explicitly. lastAttemptError
            // is not loaded here (timeout message only), so treat as transient.
            status: "failed",
            retryCount: resume.retryCount,
            totalAttempts: resume.totalAttempts,
            lastAttemptErrorType: null,
          }),
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

    // Handle queued status - show as processing with early progress
    if (resume.status === "queued") {
      return createSuccessResponse({
        status: "processing",
        progress_pct: 25,
        error: null,
        can_retry: false,
        queued: true,
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

      const parsedContent = (resumeContent?.parsedContent as string | null) ?? null;
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
    }

    if (resume.status === "failed") {
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
        status: "failed",
        progress_pct: 0,
        error: resume.errorMessage ?? null,
        can_retry: canRetryResume({
          status: resume.status,
          retryCount: resume.retryCount,
          totalAttempts: resume.totalAttempts,
          lastAttemptErrorType,
        }),
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

    // Resume is in processing state - return progress indicator
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
