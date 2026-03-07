import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

import { purgeResumeCache } from "@/lib/cloudflare-cache-purge";
import { siteData } from "@/lib/db/schema";
import { resumeContentSchemaStrict } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
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
 * Includes comprehensive validation
 *
 * Request body:
 * {
 *   content: ResumeContent
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { id, last_published_at }
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
    const {
      user: authUser,
      db,
      dbUser,
      env,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update your resume");
    if (authError) return authError;

    const userId = authUser.id;

    // 3. Parse and validate request body
    let body: UpdateRequestBody;
    try {
      body = (await request.json()) as UpdateRequestBody;
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const validation = resumeContentSchemaStrict.safeParse(body.content);

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

    // Extract preview fields for denormalized columns
    const previewFields = extractPreviewFields(content);

    // 4. Update site_data (don't return content - we already have it validated)
    const updateResult = await db
      .update(siteData)
      .set({
        content: JSON.stringify(content),
        ...previewFields,
        lastPublishedAt: now,
        updatedAt: now,
      })
      .where(eq(siteData.userId, userId))
      .returning({
        id: siteData.id,
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

    // Purge CDN edge cache so visitors see updated content immediately
    if (dbUser.handle) {
      const cfZoneId = env.CF_ZONE_ID;
      const cfApiToken = env.CF_CACHE_PURGE_API_TOKEN;
      const baseUrl = process.env.BETTER_AUTH_URL;

      if (cfZoneId && cfApiToken && baseUrl) {
        purgeResumeCache(dbUser.handle, baseUrl, cfZoneId, cfApiToken).catch(() => {
          // Error already logged inside purgeResumeCache
        });
      }
    }

    // 5. Return success response (no content echo — caller already has validated copy)
    await captureBookmark();
    return createSuccessResponse({
      success: true,
      data: {
        id: data.id,
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
