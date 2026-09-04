import { env } from "cloudflare:workers";
import { count, eq, sql } from "drizzle-orm";
import { AlertTriangle, Eye, FileText, Loader2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminSparkline } from "@/components/admin/AdminSparkline";
import { StatCard } from "@/components/admin/StatCard";
import { requireAdminAuth } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { resumes, siteData, user } from "@/lib/db/schema";
import { getPageviews, getStats } from "@/lib/umami/client";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import { formatRelativeTime } from "@/lib/utils/format";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getAdminStats() {
  const db = getDb(env.HYPERDRIVE);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [userCount, siteDataCount, resumeStats, recentSignups] = await Promise.all([
    db.select({ count: count() }).from(user),
    db.select({ count: count() }).from(siteData),
    db.select({ status: resumes.status, count: count() }).from(resumes).groupBy(resumes.status),
    db
      .select({
        email: user.email,
        name: user.name,
        previewName: siteData.previewName,
        createdAt: user.createdAt,
      })
      .from(user)
      .leftJoin(siteData, eq(user.id, siteData.userId))
      .orderBy(sql`${user.createdAt} DESC`)
      .limit(10),
  ]);

  let umamiStats: Awaited<ReturnType<typeof getStats>> | null = null;
  let umamiPageviews: Awaited<ReturnType<typeof getPageviews>> | null = null;
  try {
    [umamiStats, umamiPageviews] = await Promise.all([
      getStats(env, { startAt: todayStart.getTime(), endAt: now.getTime() }),
      getPageviews(env, {
        startAt: sevenDaysAgo.getTime(),
        endAt: now.getTime(),
        unit: "day",
        timezone: "UTC",
      }),
    ]);
  } catch (err) {
    console.error("[admin] Umami API unavailable:", err);
  }

  // SAFETY: status is a validated string column; cast initializes typed map for counting.
  const statusMap = resumeStats.reduce(
    (acc, r) => {
      acc[r.status || "unknown"] = r.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  const umamiMap = new Map(umamiPageviews?.pageviews.map((p) => [p.x.slice(0, 10), p.y]) ?? []);
  const filledDaily: Array<{ date: string; views: number }> = lastNUtcDays(7).map((date) => ({
    date,
    views: umamiMap.get(date) ?? 0,
  }));

  return {
    totalUsers: userCount[0]?.count ?? 0,
    publishedResumes: siteDataCount[0]?.count ?? 0,
    processingResumes: (statusMap.processing || 0) + (statusMap.queued || 0),
    failedResumes: statusMap.failed || 0,
    viewsToday: umamiStats?.pageviews ?? 0,
    recentSignups,
    dailyViews: filledDaily,
  };
}

export default async function AdminOverviewPage() {
  await requireAdminAuth();
  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColorClass="text-brand"
          iconBgClass="bg-brand-subtle"
        />
        <StatCard
          title="Published Resumes"
          value={stats.publishedResumes}
          icon={FileText}
          iconColorClass="text-muted-foreground"
          iconBgClass="bg-surface-2"
        />
        <StatCard
          title="Processing"
          value={stats.processingResumes}
          icon={Loader2}
          iconColorClass="text-warning"
          iconBgClass="bg-warning/10"
          href="/admin/resumes?status=processing"
        />
        <StatCard
          title="Views Today"
          value={stats.viewsToday}
          icon={Eye}
          iconColorClass="text-muted-foreground"
          iconBgClass="bg-surface-2"
        />
      </div>

      {stats.failedResumes > 0 && (
        <Link
          href="/admin/resumes?status=failed"
          className="block bg-destructive/10 border border-destructive/30 rounded-xl p-4 hover:bg-destructive/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-destructive/15 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-destructive">
                {stats.failedResumes} Failed Resume{stats.failedResumes > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-destructive">Click to view details</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Recent Signups
          </h2>
          <div className="space-y-3">
            {stats.recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signups yet</p>
            ) : (
              stats.recentSignups.map((signup, i) => {
                const displayName =
                  signup.name && signup.name !== "Unnamed"
                    ? signup.name
                    : signup.previewName?.trim() || signup.name || "Unnamed";
                return (
                  <div
                    key={`${signup.email}-${i}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{displayName}</p>
                      <p className="text-muted-foreground truncate">{signup.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/70 shrink-0 ml-2">
                      {formatRelativeTime(signup.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Views (Last 7 Days)
          </h2>
          <AdminSparkline data={stats.dailyViews} />
        </div>
      </div>
    </div>
  );
}
