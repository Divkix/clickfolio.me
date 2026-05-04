import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { getThemeReferralRequirement, isThemeUnlocked, type ThemeId } from "./theme-ids";

/**
 * Check if a user has unlocked a theme.
 * Returns null if the theme is unlocked, or an error Response if blocked.
 */
export async function verifyThemeUnlocked(
  db: Database,
  userId: string,
  themeId: ThemeId,
): Promise<Response | null> {
  const userResult = await db
    .select({ referralCount: user.referralCount, isPro: user.isPro })
    .from(user)
    .where(eq(user.id, userId));

  const referralCount = userResult[0]?.referralCount ?? 0;
  const isPro = userResult[0]?.isPro ?? false;

  if (!isThemeUnlocked(themeId, referralCount, isPro)) {
    const required = getThemeReferralRequirement(themeId);
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
  return null;
}
