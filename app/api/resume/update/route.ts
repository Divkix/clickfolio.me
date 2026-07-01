import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { siteData } from "@/lib/db/schema";
import { resumeContentSchemaStrict } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

interface UpdateRequestBody {
  content?: ResumeContent;
}

/**
 * PUT /api/resume/update
 * Updates the user's resume content in site_data.
 * Includes comprehensive validation.
 *
 * Request body:
 *   { content: ResumeContent }
 *
 * Response:
 *   { success: true, data: { id, last_published_at } }
 *
 * Rate limits:
 *   - 5 uploads per 24 hours per authenticated user
 *
 * Error codes:
 *   - 400: invalid JSON or validation failure
 *   - 413: request body too large
 *   - 500: database error or unexpected error
 */
export async function PUT(request: Request) {
  // Validate request size before parsing (prevent DoS)
  const sizeCheck = validateRequestSize(request);
  if (!sizeCheck.valid) {
    return createErrorResponse(
      sizeCheck.error || "Request body too large",
      ERROR_CODES.BAD_REQUEST,
      413,
    );
  }

  return withUser(
    request,
    async ({ user: authUser, db, captureBookmark }) => {
      const userId = authUser.id;

      // Parse and validate request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      const body = rawBodyResult.data as UpdateRequestBody;

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

      // Update site_data (don't return content - we already have it validated)
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

      // Return success response (no content echo — caller already has validated copy)
      await captureBookmark();
      return createSuccessResponse({
        success: true,
        data: {
          id: data.id,
          last_published_at: data.lastPublishedAt,
        },
      });
    },
    "You must be logged in to update your resume",
  );
}
