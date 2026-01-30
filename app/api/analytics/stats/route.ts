/**
 * GET /api/analytics/stats?period=7d|30d|90d
 *
 * Authenticated endpoint returning aggregated page view analytics
 * for the logged-in user's resume page.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

function periodToDays(period: string): number {
  switch (period) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 7;
  }
}

export async function GET(request: Request) {
  const { user, error } = await requireAuthWithMessage("Must be logged in to view analytics");
  if (error) return error;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "7d";

  if (!VALID_PERIODS.has(period)) {
    return Response.json({ error: "Invalid period. Use 7d, 30d, or 90d." }, { status: 400 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const days = periodToDays(period);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const whereClause = and(eq(pageViews.userId, user.id), gte(pageViews.createdAt, sinceDate));

    // Run all aggregation queries in parallel
    const [totals, daily, referrers, devices, countries] = await Promise.all([
      // Total views + unique visitors
      db
        .select({
          totalViews: sql<number>`COUNT(*)`,
          uniqueVisitors: sql<number>`COUNT(DISTINCT ${pageViews.visitorHash})`,
        })
        .from(pageViews)
        .where(whereClause),

      // Daily breakdown
      db
        .select({
          date: sql<string>`DATE(${pageViews.createdAt})`.as("date"),
          views: sql<number>`COUNT(*)`,
          uniques: sql<number>`COUNT(DISTINCT ${pageViews.visitorHash})`,
        })
        .from(pageViews)
        .where(whereClause)
        .groupBy(sql`DATE(${pageViews.createdAt})`)
        .orderBy(sql`DATE(${pageViews.createdAt})`),

      // Top 10 referrers (excluding nulls = direct visits)
      db
        .select({
          referrer: pageViews.referrer,
          count: sql<number>`COUNT(*)`,
        })
        .from(pageViews)
        .where(and(whereClause, sql`${pageViews.referrer} IS NOT NULL`))
        .groupBy(pageViews.referrer)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10),

      // Device breakdown
      db
        .select({
          device: pageViews.deviceType,
          count: sql<number>`COUNT(*)`,
        })
        .from(pageViews)
        .where(whereClause)
        .groupBy(pageViews.deviceType)
        .orderBy(sql`COUNT(*) DESC`),

      // Top 10 countries
      db
        .select({
          country: pageViews.country,
          count: sql<number>`COUNT(*)`,
        })
        .from(pageViews)
        .where(and(whereClause, sql`${pageViews.country} IS NOT NULL`))
        .groupBy(pageViews.country)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10),
    ]);

    // Count direct visits (referrer IS NULL)
    const totalViews = totals[0]?.totalViews ?? 0;
    const referrerViews = referrers.reduce((sum, r) => sum + r.count, 0);
    const directVisits = totalViews - referrerViews;

    // Fill missing dates with zeros for chart continuity
    const viewsByDay = fillMissingDates(daily, days);

    return Response.json({
      totalViews,
      uniqueVisitors: totals[0]?.uniqueVisitors ?? 0,
      viewsByDay,
      topReferrers: referrers.map((r) => ({
        referrer: r.referrer,
        count: r.count,
      })),
      directVisits: Math.max(0, directVisits),
      deviceBreakdown: devices.map((d) => ({
        device: d.device ?? "unknown",
        count: d.count,
      })),
      countryBreakdown: countries.map((c) => ({
        country: c.country ?? "unknown",
        count: c.count,
      })),
      period,
    });
  } catch (err) {
    console.error("[analytics/stats] Error:", err);
    return Response.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

/**
 * Fill in missing dates with zero values so the chart has continuous data points.
 */
function fillMissingDates(
  data: Array<{ date: string; views: number; uniques: number }>,
  days: number,
): Array<{ date: string; views: number; uniques: number }> {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const result: Array<{ date: string; views: number; uniques: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const existing = dataMap.get(date);
    result.push(existing ?? { date, views: 0, uniques: 0 });
  }

  return result;
}
