import { z } from "zod";
import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

import { siteData } from "@/lib/db/schema";
import { isValidThemeId, THEME_IDS } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";
interface ThemeUpdateRequestBody {
  theme_id?: string;
}

export async function POST(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

      const sizeCheck = validateRequestSize(request);
      if (!sizeCheck.valid) {
        return createErrorResponse(
          sizeCheck.error || "Request body too large",
          ERROR_CODES.BAD_REQUEST,
          413,
        );
      }

      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      // SAFETY: rawBodyResult.data is bounded JSON from validated request; cast extracts typed theme_id field.
      const body = rawBodyResult.data as ThemeUpdateRequestBody;
      const { theme_id } = body;

      if (!theme_id || !z.string().safeParse(theme_id).success) {
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

      const now = new Date().toISOString();

      const updateResult = await db
        .update(siteData)
        .set({
          themeId: theme_id,
          updatedAt: now,
        })
        .where(eq(siteData.userId, userId))
        .returning({ themeId: siteData.themeId });

      if (updateResult.length === 0) {
        return createErrorResponse(
          "Resume data not found. Please upload a resume first.",
          ERROR_CODES.NOT_FOUND,
          404,
        );
      }

      const data = updateResult[0];

      captureServerEvent(userId, "theme_changed", {
        theme_id,
      });

      return createSuccessResponse({
        success: true,
        theme_id: data.themeId,
        message: "Theme updated successfully",
      });
    },
    "You must be logged in to update theme",
  );
}
