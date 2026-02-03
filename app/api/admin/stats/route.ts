/**
 * GET /api/admin/stats
 *
 * Returns overview statistics for admin dashboard.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, gte, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { pageViews, resumes, user } from "@/lib/db/schema";

export async function GET() {
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [userStats, resumeStats, viewsToday, recentSignups, dailyViews] = await Promise.all([
      // User counts
      db
        .select({
          total: count(),
          withSiteData: sql<number>`SUM(CASE WHEN EXISTS (SELECT 1 FROM site_data WHERE site_data.user_id = user.id) THEN 1 ELSE 0 END)`,
        })
        .from(user),

      // Resume status counts
      db
        .select({
          status: resumes.status,
          count: count(),
        })
        .from(resumes)
        .groupBy(resumes.status),

      // Views today
      db
        .select({ count: count() })
        .from(pageViews)
        .where(gte(pageViews.createdAt, todayStart)),

      // Recent signups (last 10)
      db
        .select({
          email: user.email,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(sql`${user.createdAt} DESC`)
        .limit(10),

      // Daily views for sparkline (last 7 days)
      db
        .select({
          date: sql<string>`DATE(${pageViews.createdAt})`.as("date"),
          views: count(),
        })
        .from(pageViews)
        .where(gte(pageViews.createdAt, sevenDaysAgo))
        .groupBy(sql`DATE(${pageViews.createdAt})`)
        .orderBy(sql`DATE(${pageViews.createdAt})`),
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

    // Fill missing dates for sparkline
    const filledDailyViews = fillMissingDates(dailyViews, 7);

    return Response.json({
      totalUsers: userStats[0]?.total ?? 0,
      publishedResumes: userStats[0]?.withSiteData ?? 0,
      processingResumes,
      viewsToday: viewsToday[0]?.count ?? 0,
      failedResumes,
      recentSignups: recentSignups.map((u) => ({
        email: u.email,
        createdAt: u.createdAt,
      })),
      dailyViews: filledDailyViews,
    });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
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
