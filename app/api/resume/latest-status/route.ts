import { desc, eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { resumes } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/resume/latest-status
 * Get the latest resume status for the currently authenticated user
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

    // 3. Fetch the latest resume for the user
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
  } catch (err) {
    console.error("Error fetching latest resume status:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
