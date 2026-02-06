/**
 * Referral utilities for handling ?ref= parameter tracking
 *
 * Flow:
 * 1. Visitor lands on /?ref={code}
 * 2. Homepage captures and stores ref in localStorage
 * 3. Visitor signs up via OAuth
 * 4. After signup, referredBy is written to user record
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";
import { generateVisitorHashWithDate } from "@/lib/utils/analytics";
import { getClientIP } from "@/lib/utils/ip-rate-limit";

const REFERRAL_CODE_KEY = "referral_code";

// =============================================================================
// Client-side functions for referral codes
// =============================================================================

/**
 * Store referral code in localStorage (first ref wins)
 *
 * @param code - The referrer's referral code from ?ref= param
 */
export function captureReferralCode(code: string): void {
  if (typeof window === "undefined") return;

  // First ref wins - don't overwrite existing
  const existing = localStorage.getItem(REFERRAL_CODE_KEY);
  if (!existing && code && code.trim().length > 0) {
    localStorage.setItem(REFERRAL_CODE_KEY, code.trim().toUpperCase());
  }
}

/**
 * Get stored referral code from localStorage
 *
 * @returns The referral code or null
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

/**
 * Clear stored referral code from localStorage
 */
export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_CODE_KEY);
}

// =============================================================================
// Server-side functions
// =============================================================================

/**
 * Write referredBy to user record (server-side only)
 *
 * Uses atomic conditional UPDATE to prevent TOCTOU race conditions.
 * First-referral-wins: only writes if user doesn't already have a referrer.
 *
 * Validates:
 * - Referrer exists (by code)
 * - User is not self-referring
 *
 * Optimizations over naive implementation:
 * - Single getCloudflareContext + getDb instance for all queries
 * - Parallel crypto hash computation (today + yesterday via Promise.all)
 * - db.batch() for independent post-success writes (count + click conversions)
 *
 * @param userId - The ID of the user to update
 * @param referrerCode - The referral code of the referrer
 * @param request - Optional request for visitor hash matching
 * @returns Success status
 */
export async function writeReferral(
  userId: string,
  referrerCode: string,
  request?: Request,
): Promise<{ success: boolean; reason?: string }> {
  if (!referrerCode || referrerCode.trim().length === 0) {
    return { success: false, reason: "empty_ref" };
  }

  // Reject absurdly long inputs to prevent DB issues
  if (referrerCode.length > 64) {
    return { success: false, reason: "ref_too_long" };
  }

  // Single context + DB instance for the entire function
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Resolve referral code to user ID inline (avoids redundant getCloudflareContext + getDb)
  const normalizedCode = referrerCode.trim().toUpperCase();
  const referrerResult = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.referralCode, normalizedCode))
    .limit(1);

  const referrerId = referrerResult[0]?.id;
  if (!referrerId) {
    return { success: false, reason: "invalid_ref" };
  }

  // Prevent self-referral
  if (referrerId === userId) {
    return { success: false, reason: "self_referral" };
  }

  // Atomic conditional update: only set referredBy if currently null
  // This prevents TOCTOU race conditions where two concurrent requests
  // could both pass the "already referred" check
  const result = await db
    .update(user)
    .set({ referredBy: referrerId })
    .where(and(eq(user.id, userId), isNull(user.referredBy)))
    .returning({ id: user.id });

  if (result.length === 0) {
    // No rows updated - check why
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

  // Post-success: atomically increment referrer count + mark clicks as converted
  // All best-effort — the referral link above is the critical operation
  try {
    let clickMarked = false;

    if (request) {
      const ip = getClientIP(request);
      const ua = request.headers.get("user-agent") || "";
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Compute both visitor hashes in parallel instead of sequentially
      const [todayHash, yesterdayHash] = await Promise.all([
        generateVisitorHashWithDate(ip, ua, today),
        generateVisitorHashWithDate(ip, ua, yesterday),
      ]);

      // Single D1 batch: increment referralCount + try both hash-based click conversions
      // All three are independent writes executed in one HTTP roundtrip
      const [, todayClickResult, yesterdayClickResult] = await db.batch([
        db
          .update(user)
          .set({ referralCount: sql`${user.referralCount} + 1` })
          .where(eq(user.id, referrerId)),
        db
          .update(referralClicks)
          .set({ converted: true, convertedUserId: userId })
          .where(
            and(
              eq(referralClicks.referrerUserId, referrerId),
              eq(referralClicks.visitorHash, todayHash),
              eq(referralClicks.converted, false),
            ),
          )
          .returning({ id: referralClicks.id }),
        db
          .update(referralClicks)
          .set({ converted: true, convertedUserId: userId })
          .where(
            and(
              eq(referralClicks.referrerUserId, referrerId),
              eq(referralClicks.visitorHash, yesterdayHash),
              eq(referralClicks.converted, false),
            ),
          )
          .returning({ id: referralClicks.id }),
      ]);

      clickMarked = todayClickResult.length > 0 || yesterdayClickResult.length > 0;
    } else {
      // No request — just increment referral count
      await db
        .update(user)
        .set({ referralCount: sql`${user.referralCount} + 1` })
        .where(eq(user.id, referrerId));
    }

    // Fallback: if no hash match (or no request), mark most recent unconverted click
    // This maintains backwards compatibility and handles edge cases
    if (!clickMarked) {
      // SQLite/Drizzle doesn't support UPDATE with LIMIT, so SELECT first then UPDATE by ID
      const mostRecentClick = await db
        .select({ id: referralClicks.id })
        .from(referralClicks)
        .where(
          and(eq(referralClicks.referrerUserId, referrerId), eq(referralClicks.converted, false)),
        )
        .orderBy(desc(referralClicks.createdAt))
        .limit(1);

      if (mostRecentClick[0]) {
        await db
          .update(referralClicks)
          .set({ converted: true, convertedUserId: userId })
          .where(eq(referralClicks.id, mostRecentClick[0].id));
      }
    }
  } catch (error) {
    console.error("Failed to complete post-referral operations:", error);
    // Don't fail the referral write — the referredBy link was already persisted
  }

  return { success: true };
}
