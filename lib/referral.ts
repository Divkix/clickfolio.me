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
 * Resolve a referral code to a user ID (server-side only)
 *
 * @param code - The referral code to resolve
 * @returns The user ID or null if not found
 */
export async function resolveReferralCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null;
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const result = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.referralCode, code.trim().toUpperCase()))
    .limit(1);

  return result[0]?.id ?? null;
}

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

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Resolve referral code to user ID
  const referrerId = await resolveReferralCode(referrerCode);
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

  // Atomically increment referrer's referralCount
  // This only executes when a NEW referral was successfully linked above
  try {
    await db
      .update(user)
      .set({ referralCount: sql`${user.referralCount} + 1` })
      .where(eq(user.id, referrerId));
  } catch (error) {
    // Log but don't fail - referral link was already created successfully
    // The denormalized count can be reconciled later if needed
    console.error("Failed to increment referralCount for referrer:", referrerId, error);
  }

  // Mark referral clicks as converted with visitor-specific matching
  // (best effort - don't fail if this doesn't work)
  try {
    let clickMarked = false;

    if (request) {
      const ip = getClientIP(request);
      const ua = request.headers.get("user-agent") || "";
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Try today's hash first
      const todayHash = await generateVisitorHashWithDate(ip, ua, today);
      const todayResult = await db
        .update(referralClicks)
        .set({ converted: true, convertedUserId: userId })
        .where(
          and(
            eq(referralClicks.referrerUserId, referrerId),
            eq(referralClicks.visitorHash, todayHash),
            eq(referralClicks.converted, false),
          ),
        )
        .returning({ id: referralClicks.id });

      if (todayResult.length > 0) {
        clickMarked = true;
      } else {
        // Try yesterday's hash (for clicks that crossed midnight)
        const yesterdayHash = await generateVisitorHashWithDate(ip, ua, yesterday);
        const yesterdayResult = await db
          .update(referralClicks)
          .set({ converted: true, convertedUserId: userId })
          .where(
            and(
              eq(referralClicks.referrerUserId, referrerId),
              eq(referralClicks.visitorHash, yesterdayHash),
              eq(referralClicks.converted, false),
            ),
          )
          .returning({ id: referralClicks.id });

        if (yesterdayResult.length > 0) {
          clickMarked = true;
        }
      }
    }

    // Fallback: if no request or no hash match, mark most recent unconverted click
    // This maintains backwards compatibility and handles edge cases
    if (!clickMarked) {
      // Find the most recent unconverted click to mark (not all of them)
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
    console.error("Failed to mark referral clicks as converted:", error);
    // Don't fail the referral write
  }

  return { success: true };
}
