/**
 * GET /api/admin/referrals
 *
 * Returns referral program statistics.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, desc, eq, gt, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";

export const runtime = "edge";

export async function GET() {
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const [referrerCount, clickStats, sourceBreakdown, topReferrers, recentConversions] =
      await Promise.all([
        // Count users with at least 1 referral
        db
          .select({ count: count() })
          .from(user)
          .where(gt(user.referralCount, 0)),

        // Click and conversion stats
        db
          .select({
            totalClicks: count(),
            uniqueClicks: sql<number>`COUNT(DISTINCT ${referralClicks.visitorHash})`,
            conversions: sql<number>`SUM(CASE WHEN ${referralClicks.converted} = 1 THEN 1 ELSE 0 END)`,
          })
          .from(referralClicks),

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

        // Recent conversions
        db
          .select({
            id: referralClicks.id,
            referrerUserId: referralClicks.referrerUserId,
            convertedUserId: referralClicks.convertedUserId,
            createdAt: referralClicks.createdAt,
          })
          .from(referralClicks)
          .where(eq(referralClicks.converted, true))
          .orderBy(sql`${referralClicks.createdAt} DESC`)
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

    // Get user details for recent conversions
    const conversionUserIds = [
      ...new Set([
        ...recentConversions.map((c) => c.referrerUserId),
        ...recentConversions.filter((c) => c.convertedUserId).map((c) => c.convertedUserId!),
      ]),
    ];

    const conversionUsers =
      conversionUserIds.length > 0
        ? await db
            .select({ id: user.id, email: user.email, handle: user.handle })
            .from(user)
            .where(
              sql`${user.id} IN (${sql.join(
                conversionUserIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
        : [];

    const userMap = new Map(conversionUsers.map((u) => [u.id, u]));

    // Calculate stats
    const totalClicks = clickStats[0]?.totalClicks ?? 0;
    const uniqueClicks = clickStats[0]?.uniqueClicks ?? 0;
    const conversions = clickStats[0]?.conversions ?? 0;
    const conversionRate = uniqueClicks > 0 ? ((conversions / uniqueClicks) * 100).toFixed(1) : "0";

    // Calculate source percentages
    const totalSourceClicks = sourceBreakdown.reduce((sum, s) => sum + s.count, 0);

    return Response.json({
      stats: {
        totalReferrers: referrerCount[0]?.count ?? 0,
        totalClicks,
        conversions,
        conversionRate: Number.parseFloat(conversionRate),
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
      recentConversions: recentConversions.map((c) => ({
        newUserEmail: userMap.get(c.convertedUserId!)?.email ?? "Unknown",
        referrerHandle: userMap.get(c.referrerUserId)?.handle ?? "unknown",
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/referrals] Error:", err);
    return Response.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}
