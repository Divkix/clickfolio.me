import { env } from "cloudflare:workers";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";
import { getClientIP } from "@/lib/rate-limit/ip";
import { generateVisitorHashWithDate } from "@/lib/utils/analytics";

/**
 * Links a user to a referrer once, then best-effort marks the matching click converted.
 * This module is server-only because it imports the Hyperdrive Postgres adapter.
 */
export async function writeReferral(
  userId: string,
  referrerCode: string,
  request?: Request,
): Promise<{ success: boolean; reason?: string }> {
  if (!referrerCode || referrerCode.trim().length === 0) {
    return { success: false, reason: "empty_ref" };
  }

  if (referrerCode.length > 64) {
    return { success: false, reason: "ref_too_long" };
  }

  const db = getDb(env.HYPERDRIVE);
  const trimmed = referrerCode.trim();
  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const normalizedUpper = normalized.toUpperCase();
  const normalizedLower = normalized.toLowerCase();

  const referrerResult = await db
    .select({ id: user.id })
    .from(user)
    .where(or(eq(user.referralCode, normalizedUpper), eq(user.handle, normalizedLower)))
    .limit(1);

  const referrerId = referrerResult[0]?.id;
  if (!referrerId) {
    return { success: false, reason: "invalid_ref" };
  }
  if (referrerId === userId) {
    return { success: false, reason: "self_referral" };
  }

  const now = new Date().toISOString();
  const result = await db
    .update(user)
    .set({ referredBy: referrerId, referredAt: now })
    .where(and(eq(user.id, userId), isNull(user.referredBy)))
    .returning({ id: user.id });

  if (result.length === 0) {
    const existingUser = await db
      .select({ id: user.id, referredBy: user.referredBy })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser[0]) {
      return { success: false, reason: "user_not_found" };
    }
    return { success: false, reason: "already_referred" };
  }

  try {
    if (request) {
      const ip = getClientIP(request);
      const ua = request.headers.get("user-agent") || "";
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const [todayHash, yesterdayHash] = await Promise.all([
        generateVisitorHashWithDate(ip, ua, today),
        generateVisitorHashWithDate(ip, ua, yesterday),
      ]);

      const todayClickResult = await db
        .update(referralClicks)
        .set({ converted: true, convertedUserId: userId, convertedAt: now })
        .where(
          and(
            eq(referralClicks.referrerUserId, referrerId),
            eq(referralClicks.visitorHash, todayHash),
            eq(referralClicks.converted, false),
          ),
        )
        .returning({ id: referralClicks.id });

      if (todayClickResult.length === 0) {
        await db
          .update(referralClicks)
          .set({ converted: true, convertedUserId: userId, convertedAt: now })
          .where(
            and(
              eq(referralClicks.referrerUserId, referrerId),
              eq(referralClicks.visitorHash, yesterdayHash),
              eq(referralClicks.converted, false),
            ),
          )
          .returning({ id: referralClicks.id });
      }
    }
  } catch (error) {
    console.error("Failed to complete post-referral operations:", error);
  }

  return { success: true };
}
