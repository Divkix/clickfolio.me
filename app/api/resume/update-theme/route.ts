import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { invalidateResumeCache } from "@/lib/cache/invalidation";
import { purgeResumeCache } from "@/lib/cloudflare-cache-purge";
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
      dbUser,
      env,
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
    // Use pre-computed referralCount column instead of COUNT query
    const userResult = await db
      .select({ referralCount: user.referralCount, isPro: user.isPro })
      .from(user)
      .where(eq(user.id, userId));

    const referralCount = userResult[0]?.referralCount ?? 0;
    const isPro = userResult[0]?.isPro ?? false;

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

    // Invalidate KV cache for this user's public resume page
    if (dbUser.handle) {
      await invalidateResumeCache(dbUser.handle);

      // Also purge CDN edge cache so visitors see updated theme immediately
      const cfZoneId = env.CF_ZONE_ID;
      const cfApiToken = env.CF_CACHE_PURGE_API_TOKEN;
      const baseUrl = process.env.BETTER_AUTH_URL;

      if (cfZoneId && cfApiToken && baseUrl) {
        purgeResumeCache(dbUser.handle, baseUrl, cfZoneId, cfApiToken).catch(() => {
          // Error already logged inside purgeResumeCache
        });
      }
    }

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
