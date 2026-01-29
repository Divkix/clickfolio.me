import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { siteData, user } from "@/lib/db/schema";
import {
  getThemeReferralRequirement,
  isThemeUnlocked,
  isValidThemeId,
  THEME_IDS,
  type ThemeId,
} from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

interface ThemeUpdateRequestBody {
  theme_id?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user and validate existence in database
    const { env } = await getCloudflareContext({ async: true });
    const {
      user: authUser,
      db,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update theme", env.DB);
    if (authError) return authError;

    const userId = authUser.id;

    // 4. Parse request body
    const body = (await request.json()) as ThemeUpdateRequestBody;
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
    const [referralCountResult, userProStatus] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(user).where(eq(user.referredBy, userId)),
      db.select({ isPro: user.isPro }).from(user).where(eq(user.id, userId)),
    ]);
    const referralCount = referralCountResult[0]?.count ?? 0;
    const isPro = userProStatus[0]?.isPro ?? false;

    if (!isThemeUnlocked(theme_id as ThemeId, referralCount, isPro)) {
      const required = getThemeReferralRequirement(theme_id as ThemeId);
      return createErrorResponse(
        `This theme requires ${required} referral${required === 1 ? "" : "s"} to unlock. You have ${referralCount}.`,
        ERROR_CODES.FORBIDDEN,
        403,
        {
          required_referrals: required,
          current_referrals: referralCount,
        },
      );
    }

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
