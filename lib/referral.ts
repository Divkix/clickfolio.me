/**
 * Referral utilities for handling ?ref= parameter tracking
 *
 * Flow:
 * 1. Visitor lands on /?ref={handle}
 * 2. Homepage captures and stores ref in localStorage
 * 3. Visitor signs up via OAuth
 * 4. After signup, referredBy is written to user record
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";
import { generateVisitorHashWithDate } from "@/lib/utils/analytics";
import { getClientIP } from "@/lib/utils/ip-rate-limit";

const REFERRAL_KEY = "referral_handle";

/**
 * Store referral handle in localStorage (first ref wins)
 *
 * @param handle - The referrer's handle from ?ref= param
 */
export function captureReferralHandle(handle: string): void {
  if (typeof window === "undefined") return;

  // First ref wins - don't overwrite existing
  const existing = localStorage.getItem(REFERRAL_KEY);
  if (!existing && handle && handle.trim().length > 0) {
    localStorage.setItem(REFERRAL_KEY, handle.trim().toLowerCase());
  }
}

/**
 * Get stored referral handle from localStorage
 *
 * @returns The referral handle or null
 */
export function getStoredReferralHandle(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_KEY);
}

/**
 * Clear stored referral handle from localStorage
 */
export function clearStoredReferralHandle(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_KEY);
}

/**
 * Resolve a handle to a user ID (server-side only)
 *
 * @param handle - The handle to resolve
 * @returns The user ID or null if not found
 */
export async function resolveReferralHandle(handle: string): Promise<string | null> {
  if (!handle || handle.trim().length === 0) {
    return null;
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const result = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, handle.toLowerCase()))
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
 * - Referrer exists
 * - User is not self-referring
 *
 * @param userId - The ID of the user to update
 * @param referrerHandle - The handle of the referrer
 * @param request - Optional request for visitor hash matching
 * @returns Success status
 */
export async function writeReferral(
  userId: string,
  referrerHandle: string,
  request?: Request,
): Promise<{ success: boolean; reason?: string }> {
  if (!referrerHandle || referrerHandle.trim().length === 0) {
    return { success: false, reason: "empty_handle" };
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  // Resolve handle to user ID
  const referrerId = await resolveReferralHandle(referrerHandle);
  if (!referrerId) {
    return { success: false, reason: "invalid_handle" };
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
      await db
        .update(referralClicks)
        .set({ converted: true, convertedUserId: userId })
        .where(
          and(eq(referralClicks.referrerUserId, referrerId), eq(referralClicks.converted, false)),
        );
    }
  } catch (error) {
    console.error("Failed to mark referral clicks as converted:", error);
    // Don't fail the referral write
  }

  return { success: true };
}
