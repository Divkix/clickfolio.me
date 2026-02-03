import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, gte, sql } from "drizzle-orm";
import { AlertTriangle, Eye, FileText, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { AdminSparkline } from "@/components/admin/AdminSparkline";
import { StatCard } from "@/components/admin/StatCard";
import { requireAdminAuth } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { pageViews, resumes, siteData, user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function getStats() {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [userCount, siteDataCount, resumeStats, viewsToday, recentSignups, dailyViews] =
    await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(siteData),
      db.select({ status: resumes.status, count: count() }).from(resumes).groupBy(resumes.status),
      db.select({ count: count() }).from(pageViews).where(gte(pageViews.createdAt, todayStart)),
      db
        .select({ email: user.email, name: user.name, createdAt: user.createdAt })
        .from(user)
        .orderBy(sql`${user.createdAt} DESC`)
        .limit(10),
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

  const statusMap = resumeStats.reduce(
    (acc, r) => {
      acc[r.status || "unknown"] = r.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Fill missing dates
  const filledDaily: Array<{ date: string; views: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const existing = dailyViews.find((d) => d.date === date);
    filledDaily.push({ date, views: existing?.views ?? 0 });
  }

  return {
    totalUsers: userCount[0]?.count ?? 0,
    publishedResumes: siteDataCount[0]?.count ?? 0,
    processingResumes: (statusMap.processing || 0) + (statusMap.queued || 0),
    failedResumes: statusMap.failed || 0,
    viewsToday: viewsToday[0]?.count ?? 0,
    recentSignups,
    dailyViews: filledDaily,
  };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default async function AdminOverviewPage() {
  await requireAdminAuth();
  const stats = await getStats();

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColorClass="text-indigo-600"
          iconBgClass="bg-linear-to-r from-indigo-100 to-blue-100"
        />
        <StatCard
          title="Published Resumes"
          value={stats.publishedResumes}
          icon={FileText}
          iconColorClass="text-emerald-600"
          iconBgClass="bg-linear-to-r from-emerald-100 to-teal-100"
        />
        <StatCard
          title="Processing"
          value={stats.processingResumes}
          icon={Loader2}
          iconColorClass="text-amber-600"
          iconBgClass="bg-linear-to-r from-amber-100 to-orange-100"
          href="/admin/resumes?status=processing"
        />
        <StatCard
          title="Views Today"
          value={stats.viewsToday}
          icon={Eye}
          iconColorClass="text-purple-600"
          iconBgClass="bg-linear-to-r from-purple-100 to-pink-100"
        />
      </div>

      {/* Failed Resumes Alert */}
      {stats.failedResumes > 0 && (
        <Link
          href="/admin/resumes?status=failed"
          className="block bg-red-50 border border-red-200 rounded-2xl p-4 hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-red-900">
                {stats.failedResumes} Failed Resume{stats.failedResumes > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-red-700">Click to view details</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Recent Signups
          </h2>
          <div className="space-y-3">
            {stats.recentSignups.length === 0 ? (
              <p className="text-sm text-slate-500">No signups yet</p>
            ) : (
              stats.recentSignups.map((signup, i) => (
                <div
                  key={`${signup.email}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {signup.name || "Unnamed"}
                    </p>
                    <p className="text-slate-500 truncate">{signup.email}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    {formatRelativeTime(signup.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Views Sparkline */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Views (Last 7 Days)
          </h2>
          <AdminSparkline data={stats.dailyViews} />
        </div>
      </div>
    </div>
  );
}
