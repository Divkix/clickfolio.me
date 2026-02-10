/**
 * GET /api/admin/stats
 *
 * Returns overview statistics for admin dashboard.
 * User/resume stats from D1, traffic stats from Umami.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { resumes, siteData, user } from "@/lib/db/schema";
import { getPageviews, getStats } from "@/lib/umami/client";

export async function GET() {
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [userStats, siteDataCount, resumeStats, umamiStats, umamiPageviews, recentSignups] =
      await Promise.all([
        // Total user count
        db.select({ total: count() }).from(user),

        // Users with site data
        db.select({ count: count() }).from(siteData),

        // Resume status counts
        db
          .select({
            status: resumes.status,
            count: count(),
          })
          .from(resumes)
          .groupBy(resumes.status),

        // Views today via Umami
        getStats(env, { startAt: todayStart.getTime(), endAt: now.getTime() }),

        // Daily views for sparkline (last 7 days) via Umami
        getPageviews(env, {
          startAt: sevenDaysAgo.getTime(),
          endAt: now.getTime(),
          unit: "day",
          timezone: "UTC",
        }),

        // Recent signups (last 10)
        db
          .select({
            email: user.email,
            createdAt: user.createdAt,
          })
          .from(user)
          .orderBy(sql`${user.createdAt} DESC`)
          .limit(10),
      ]);

    // Process resume stats
    const resumeStatusMap = resumeStats.reduce(
      (acc, r) => {
        acc[r.status || "unknown"] = r.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const processingResumes = (resumeStatusMap.processing || 0) + (resumeStatusMap.queued || 0);
    const failedResumes = resumeStatusMap.failed || 0;

    // Fill missing dates for sparkline from Umami pageviews
    // Umami returns x as full ISO timestamp (e.g. "2026-02-09T00:00:00Z") when timezone=UTC,
    // so normalize to YYYY-MM-DD for consistent date matching.
    const filledDailyViews = fillMissingDates(
      umamiPageviews.pageviews.map((p) => ({ date: p.x.slice(0, 10), views: p.y })),
      7,
    );

    return Response.json({
      totalUsers: userStats[0]?.total ?? 0,
      publishedResumes: siteDataCount[0]?.count ?? 0,
      processingResumes,
      viewsToday: umamiStats.pageviews ?? 0,
      failedResumes,
      recentSignups: recentSignups.map((u) => ({
        email: u.email,
        createdAt: u.createdAt,
      })),
      dailyViews: filledDailyViews,
    });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return Response.json({ error: "Stats temporarily unavailable" }, { status: 503 });
  }
}

function fillMissingDates(
  data: Array<{ date: string; views: number }>,
  days: number,
): Array<{ date: string; views: number }> {
  const dataMap = new Map(data.map((d) => [d.date, d.views]));
  const result: Array<{ date: string; views: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    result.push({ date, views: dataMap.get(date) ?? 0 });
  }

  return result;
}
