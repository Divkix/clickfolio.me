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
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";

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
 * Validates:
 * - Referrer exists
 * - User doesn't already have a referrer
 * - User is not self-referring
 *
 * @param userId - The ID of the user to update
 * @param referrerHandle - The handle of the referrer
 * @returns Success status
 */
export async function writeReferral(
  userId: string,
  referrerHandle: string,
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

  // Check if user already has a referrer
  const currentUser = await db
    .select({ referredBy: user.referredBy })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (currentUser[0]?.referredBy) {
    return { success: false, reason: "already_referred" };
  }

  // Write referral
  await db.update(user).set({ referredBy: referrerId }).where(eq(user.id, userId));

  // Mark any unconverted clicks from this referrer as converted
  // (best effort - don't fail if this doesn't work)
  try {
    await db
      .update(referralClicks)
      .set({
        converted: true,
        convertedUserId: userId,
      })
      .where(
        and(eq(referralClicks.referrerUserId, referrerId), eq(referralClicks.converted, false)),
      );
  } catch (error) {
    console.error("Failed to mark referral clicks as converted:", error);
    // Don't fail the referral write
  }

  return { success: true };
}
