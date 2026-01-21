import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { resumes } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
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
    // 1. Get D1 database binding
    const { env } = await getCloudflareContext({ async: true });
    const { db } = await getSessionDb(env.DB);

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
