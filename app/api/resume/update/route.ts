import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { getResumeCacheTag } from "@/lib/data/resume";
import { siteData } from "@/lib/db/schema";
import { resumeContentSchema } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

interface UpdateRequestBody {
  content?: ResumeContent;
}

/**
 * PUT /api/resume/update
 * Updates the user's resume content in site_data
 * Includes rate limiting (10 updates per hour) and comprehensive validation
 *
 * Request body:
 * {
 *   content: ResumeContent
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { id, content, last_published_at }
 * }
 */
export async function PUT(request: Request) {
  try {
    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 2. Authenticate user and validate existence in database
    const { env } = await getCloudflareContext({ async: true });
    const {
      user: authUser,
      db,
      captureBookmark,
      dbUser,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update your resume", env.DB);
    if (authError) return authError;

    const userId = authUser.id;
    const userHandle = dbUser.handle;

    // 5. Check rate limit (10 updates per hour)
    const rateLimitResponse = await enforceRateLimit(userId, "resume_update");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 6. Parse and validate request body
    let body: UpdateRequestBody;
    try {
      body = (await request.json()) as UpdateRequestBody;
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const validation = resumeContentSchema.safeParse(body.content);

    if (!validation.success) {
      return createErrorResponse(
        "Validation failed. Please check your input.",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues,
      );
    }

    const content = validation.data;
    const now = new Date().toISOString();

    // 7. Update site_data
    const updateResult = await db
      .update(siteData)
      .set({
        content: JSON.stringify(content),
        lastPublishedAt: now,
        updatedAt: now,
      })
      .where(eq(siteData.userId, userId))
      .returning({
        id: siteData.id,
        content: siteData.content,
        lastPublishedAt: siteData.lastPublishedAt,
      });

    if (updateResult.length === 0) {
      return createErrorResponse(
        "Failed to update resume. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    const data = updateResult[0];

    // 8. Invalidate cache for public resume page synchronously
    if (userHandle) {
      revalidateTag(getResumeCacheTag(userHandle), "max");
      revalidatePath(`/${userHandle}`);
    }

    // 9. Return success response
    await captureBookmark();
    return createSuccessResponse({
      success: true,
      data: {
        id: data.id,
        content: JSON.parse(data.content),
        last_published_at: data.lastPublishedAt,
      },
    });
  } catch (error) {
    console.error("Unexpected error in resume update:", error);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
