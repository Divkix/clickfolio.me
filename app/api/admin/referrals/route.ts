/**
 * GET /api/admin/referrals
 *
 * Returns referral program statistics.
 */

import { env } from "cloudflare:workers";
import { count, desc, gt, isNotNull, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";

export async function GET() {
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  try {
    const db = getDb(env.DB);

    const [
      referrerCount,
      clickStats,
      creditedSignupsCount,
      sourceBreakdown,
      topReferrers,
      recentReferrals,
    ] = await Promise.all([
      // Count users with at least 1 referral
      db.select({ count: count() }).from(user).where(gt(user.referralCount, 0)),

      // Click and attribution stats (from click tracking)
      db
        .select({
          totalClicks: count(),
          uniqueClicks: sql<number>`COUNT(DISTINCT ${referralClicks.visitorHash})`,
          attributedConversions: sql<number>`SUM(CASE WHEN ${referralClicks.converted} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(referralClicks),

      // Credited signups (source of truth: user.referredBy)
      db.select({ count: count() }).from(user).where(isNotNull(user.referredBy)),

      // Source breakdown
      db
        .select({
          source: referralClicks.source,
          count: count(),
        })
        .from(referralClicks)
        .groupBy(referralClicks.source)
        .orderBy(sql`COUNT(*) DESC`),

      // Top referrers by conversions
      db
        .select({
          userId: user.id,
          handle: user.handle,
          referralCount: user.referralCount,
        })
        .from(user)
        .where(gt(user.referralCount, 0))
        .orderBy(desc(user.referralCount))
        .limit(20),

      // Recent credited referrals (not click attributions)
      db
        .select({
          newUserEmail: user.email,
          referrerUserId: user.referredBy,
          referredAt: user.referredAt,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(isNotNull(user.referredBy))
        .orderBy(sql`COALESCE(${user.referredAt}, ${user.createdAt}) DESC`)
        .limit(10),
    ]);

    // Get referrer handles and click counts for top referrers
    const referrerIds = topReferrers.map((r) => r.userId);
    const clickCounts =
      referrerIds.length > 0
        ? await db
            .select({
              referrerUserId: referralClicks.referrerUserId,
              clicks: count(),
            })
            .from(referralClicks)
            .where(
              sql`${referralClicks.referrerUserId} IN (${sql.join(
                referrerIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
            .groupBy(referralClicks.referrerUserId)
        : [];

    const clickCountMap = new Map(clickCounts.map((c) => [c.referrerUserId, c.clicks]));

    // Calculate stats
    const totalClicks = clickStats[0]?.totalClicks ?? 0;
    const uniqueClicks = clickStats[0]?.uniqueClicks ?? 0;
    const attributedConversions = clickStats[0]?.attributedConversions ?? 0;
    const creditedSignups = creditedSignupsCount[0]?.count ?? 0;

    // Keep existing `conversions` field for the UI, but define it as credited signups
    // (source of truth for theme unlocks + referralCount).
    const conversions = creditedSignups;

    const conversionRate =
      uniqueClicks > 0 ? ((creditedSignups / uniqueClicks) * 100).toFixed(1) : "0";
    const attributedConversionRate =
      uniqueClicks > 0 ? ((attributedConversions / uniqueClicks) * 100).toFixed(1) : "0";

    // Calculate source percentages
    const totalSourceClicks = sourceBreakdown.reduce((sum, s) => sum + s.count, 0);

    // Resolve referrer handles for recent referrals
    const recentReferrerIds = [
      ...new Set(recentReferrals.map((r) => r.referrerUserId).filter(Boolean)),
    ] as string[];

    const recentReferrers =
      recentReferrerIds.length > 0
        ? await db
            .select({ id: user.id, handle: user.handle })
            .from(user)
            .where(
              sql`${user.id} IN (${sql.join(
                recentReferrerIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
        : [];

    const recentReferrerHandleMap = new Map(recentReferrers.map((u) => [u.id, u.handle]));

    return Response.json({
      stats: {
        totalReferrers: referrerCount[0]?.count ?? 0,
        totalClicks,
        conversions,
        conversionRate: Number.parseFloat(conversionRate),
        uniqueClicks,
        attributedConversions,
        attributedConversionRate: Number.parseFloat(attributedConversionRate),
        unattributedConversions: Math.max(0, creditedSignups - attributedConversions),
      },
      funnel: {
        clicks: totalClicks,
        unique: uniqueClicks,
        signups: conversions,
      },
      topReferrers: topReferrers.map((r) => ({
        handle: r.handle || "unknown",
        clicks: clickCountMap.get(r.userId) ?? 0,
        conversions: r.referralCount,
        rate:
          (clickCountMap.get(r.userId) ?? 0) > 0
            ? ((r.referralCount / (clickCountMap.get(r.userId) ?? 1)) * 100).toFixed(1)
            : "0",
      })),
      sources: sourceBreakdown.map((s) => ({
        source: s.source || "unknown",
        percent: totalSourceClicks > 0 ? Math.round((s.count / totalSourceClicks) * 100) : 0,
      })),
      recentConversions: recentReferrals.map((r) => ({
        newUserEmail: r.newUserEmail ?? "Unknown",
        referrerHandle: recentReferrerHandleMap.get(r.referrerUserId ?? "") ?? "unknown",
        createdAt: r.referredAt || r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/referrals] Error:", err);
    return Response.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}
