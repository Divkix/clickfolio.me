import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

import { siteData } from "@/lib/db/schema";
import { verifyThemeUnlocked } from "@/lib/templates/theme-access";
import { isValidThemeId, THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

interface ThemeUpdateRequestBody {
  theme_id?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user and validate existence in database
    const {
      user: authUser,
      db,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update theme");
    if (authError) return authError;

    const userId = authUser.id;

    // 3. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 4. Parse request body
    let body: ThemeUpdateRequestBody;
    try {
      body = (await request.json()) as ThemeUpdateRequestBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { theme_id } = body;

    // 5. Validate theme_id
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

    // 5b. Check if theme is locked behind referral requirement
    const themeError = await verifyThemeUnlocked(db, userId, theme_id as ThemeId);
    if (themeError) return themeError;

    const now = new Date().toISOString();

    // 6. Update site_data theme_id
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

    return createSuccessResponse({
      success: true,
      theme_id: data.themeId,
      message: "Theme updated successfully",
    });
  } catch (error) {
    console.error("Theme update error:", error);
    return createErrorResponse(
      "An unexpected error occurred while updating theme",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
