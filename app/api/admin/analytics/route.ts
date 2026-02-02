/**
 * GET /api/admin/analytics?period=7d|30d|90d
 *
 * Returns platform-wide traffic analytics.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, gte, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { pageViews, user } from "@/lib/db/schema";

export const runtime = "edge";

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
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "7d";

  if (!VALID_PERIODS.has(period)) {
    return Response.json({ error: "Invalid period" }, { status: 400 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const days = periodToDays(period);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const prevPeriodStart = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

    const [currentTotals, prevTotals, daily, topProfiles, referrers, countries, devices] =
      await Promise.all([
        // Current period totals
        db
          .select({
            views: count(),
            unique: sql<number>`COUNT(DISTINCT ${pageViews.visitorHash})`,
            profiles: sql<number>`COUNT(DISTINCT ${pageViews.userId})`,
          })
          .from(pageViews)
          .where(gte(pageViews.createdAt, sinceDate)),

        // Previous period totals (for comparison)
        db
          .select({
            views: count(),
            unique: sql<number>`COUNT(DISTINCT ${pageViews.visitorHash})`,
          })
          .from(pageViews)
          .where(
            sql`${pageViews.createdAt} >= ${prevPeriodStart} AND ${pageViews.createdAt} < ${sinceDate}`,
          ),

        // Daily breakdown
        db
          .select({
            date: sql<string>`DATE(${pageViews.createdAt})`.as("date"),
            views: count(),
            unique: sql<number>`COUNT(DISTINCT ${pageViews.visitorHash})`,
          })
          .from(pageViews)
          .where(gte(pageViews.createdAt, sinceDate))
          .groupBy(sql`DATE(${pageViews.createdAt})`)
          .orderBy(sql`DATE(${pageViews.createdAt})`),

        // Top 10 profiles by views
        db
          .select({
            userId: pageViews.userId,
            views: count(),
            handle: user.handle,
          })
          .from(pageViews)
          .leftJoin(user, sql`${pageViews.userId} = ${user.id}`)
          .where(gte(pageViews.createdAt, sinceDate))
          .groupBy(pageViews.userId, user.handle)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(10),

        // Top referrers
        db
          .select({
            referrer: pageViews.referrer,
            count: count(),
          })
          .from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${sinceDate} AND ${pageViews.referrer} IS NOT NULL`)
          .groupBy(pageViews.referrer)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(10),

        // Countries
        db
          .select({
            country: pageViews.country,
            count: count(),
          })
          .from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${sinceDate} AND ${pageViews.country} IS NOT NULL`)
          .groupBy(pageViews.country)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(10),

        // Devices
        db
          .select({
            device: pageViews.deviceType,
            count: count(),
          })
          .from(pageViews)
          .where(gte(pageViews.createdAt, sinceDate))
          .groupBy(pageViews.deviceType)
          .orderBy(sql`COUNT(*) DESC`),
      ]);

    const totalViews = currentTotals[0]?.views ?? 0;
    const prevViews = prevTotals[0]?.views ?? 0;
    const totalUnique = currentTotals[0]?.unique ?? 0;
    const prevUnique = prevTotals[0]?.unique ?? 0;

    // Calculate percentage changes
    const viewsChange =
      prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : 0;
    const uniqueChange =
      prevUnique > 0 ? Math.round(((totalUnique - prevUnique) / prevUnique) * 100) : 0;
    const avgPerDay = Math.round(totalViews / days);
    const prevAvgPerDay = Math.round(prevViews / days);
    const avgChange =
      prevAvgPerDay > 0 ? Math.round(((avgPerDay - prevAvgPerDay) / prevAvgPerDay) * 100) : 0;

    // Fill missing dates
    const filledDaily = fillMissingDates(daily, days);

    // Calculate percentages for breakdowns
    const totalReferrer = referrers.reduce((sum, r) => sum + r.count, 0);
    const totalCountry = countries.reduce((sum, c) => sum + c.count, 0);
    const totalDevice = devices.reduce((sum, d) => sum + d.count, 0);

    return Response.json({
      totals: {
        views: totalViews,
        unique: totalUnique,
        avgPerDay,
        profilesViewed: currentTotals[0]?.profiles ?? 0,
      },
      changes: {
        views: viewsChange,
        unique: uniqueChange,
        avgPerDay: avgChange,
      },
      daily: filledDaily,
      topProfiles: topProfiles.map((p) => ({
        handle: p.handle || "unknown",
        views: p.views,
      })),
      referrers: referrers.map((r) => ({
        domain: r.referrer || "unknown",
        count: r.count,
        percent: totalReferrer > 0 ? Math.round((r.count / totalReferrer) * 100) : 0,
      })),
      countries: countries.map((c) => ({
        code: c.country || "unknown",
        name: c.country || "Unknown",
        percent: totalCountry > 0 ? Math.round((c.count / totalCountry) * 100) : 0,
      })),
      devices: devices.map((d) => ({
        type: d.device || "unknown",
        percent: totalDevice > 0 ? Math.round((d.count / totalDevice) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error("[admin/analytics] Error:", err);
    return Response.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

function fillMissingDates(
  data: Array<{ date: string; views: number; unique: number }>,
  days: number,
): Array<{ date: string; views: number; unique: number }> {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const result: Array<{ date: string; views: number; unique: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const existing = dataMap.get(date);
    result.push(existing ?? { date, views: 0, unique: 0 });
  }

  return result;
}
