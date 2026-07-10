import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { getPostHogClient } from "@/lib/posthog-server";

import { siteData } from "@/lib/db/schema";
import { verifyThemeUnlocked } from "@/lib/templates/theme-access";
import { isValidThemeId, THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

interface ThemeUpdateRequestBody {
  theme_id?: string;
}

/**
 * POST /api/resume/update-theme
 * Updates the theme for a user's resume.
 *
 * Request body:
 *   { theme_id: string }
 *
 * Validation:
 *   - theme_id must be a valid entry in THEME_IDS
 *   - Premium/locked themes require referral unlock via verifyThemeUnlocked
 *
 * Error codes:
 *   - 400: missing or invalid theme_id, or theme locked behind referral requirement
 *   - 404: site_data not found (resume not uploaded yet)
 *   - 500: unexpected error
 */
export async function POST(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db, captureBookmark }) => {
      const userId = authUser.id;

      // Validate request size before parsing (prevent DoS)
      const sizeCheck = validateRequestSize(request);
      if (!sizeCheck.valid) {
        return createErrorResponse(
          sizeCheck.error || "Request body too large",
          ERROR_CODES.BAD_REQUEST,
          413,
        );
      }

      // Parse request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      const body = rawBodyResult.data as ThemeUpdateRequestBody;
      const { theme_id } = body;

      // Validate theme_id
      if (!theme_id || typeof theme_id !== "string") {
        return createErrorResponse(
          "theme_id is required and must be a string",
          ERROR_CODES.BAD_REQUEST,
          400,
        );
      }

      if (!isValidThemeId(theme_id)) {
        return createErrorResponse("Invalid theme_id provided", ERROR_CODES.VALIDATION_ERROR, 400, {
          valid_themes: [...THEME_IDS],
        });
      }

      // Check if theme is locked behind referral requirement
      const themeError = await verifyThemeUnlocked(db, userId, theme_id as ThemeId);
      if (themeError) return themeError;

      const now = new Date().toISOString();

      // Update site_data theme_id
      const updateResult = await db
        .update(siteData)
        .set({
          themeId: theme_id,
          updatedAt: now,
        })
        .where(eq(siteData.userId, userId))
        .returning({ themeId: siteData.themeId });

      if (updateResult.length === 0) {
        // No rows updated - site_data doesn't exist yet
        return createErrorResponse(
          "Resume data not found. Please upload a resume first.",
          ERROR_CODES.NOT_FOUND,
          404,
        );
      }

      const data = updateResult[0];

      await captureBookmark();

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: "theme_changed",
        properties: { theme_id: data.themeId },
      });
      await posthog.shutdown();

      return createSuccessResponse({
        success: true,
        theme_id: data.themeId,
        message: "Theme updated successfully",
      });
    },
    "You must be logged in to update theme",
  );
}
