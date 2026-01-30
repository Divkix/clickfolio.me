/**
 * Referral count queries for dashboard display
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * Get the count of users referred by a given user
 *
 * @param userId - The referrer's user ID
 * @returns The count of referred users
 */
export async function getReferralCount(userId: string): Promise<number> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(eq(user.referredBy, userId));

  return result[0]?.count ?? 0;
}

/**
 * Check if a user was referred by someone
 *
 * @param userId - The user ID to check
 * @returns The referrer's user ID or null
 */
export async function getReferrer(userId: string): Promise<string | null> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const result = await db
    .select({ referredBy: user.referredBy })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result[0]?.referredBy ?? null;
}
