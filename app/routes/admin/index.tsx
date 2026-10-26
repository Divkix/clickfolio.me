import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, FileText, Loader2, Users } from "lucide-react";
import { AdminSparkline } from "@/components/admin/AdminSparkline";
import { StatCard } from "@/components/admin/StatCard";
import { adminOverviewPageData } from "@/lib/data/admin-overview";
import { privatePageHead } from "@/lib/seo/page-metadata";
import { formatRelativeTime } from "@/lib/utils/format";

const getOverview = createServerFn({ method: "GET" }).handler(() => adminOverviewPageData());

export const Route = createFileRoute("/admin/")({
  head: () => privatePageHead("Admin"),
  loader: () => getOverview(),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const stats = Route.useLoaderData();

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
          linkOptions={{ to: "/admin/resumes", search: { status: "processing", page: 1 } }}
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
          to="/admin/resumes"
          search={{ status: "failed", page: 1 }}
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
              stats.recentSignups.map((signup) => {
                const displayName =
                  signup.name && signup.name !== "Unnamed"
                    ? signup.name
                    : signup.previewName?.trim() || signup.name || "Unnamed";

                return (
                  <div key={signup.email} className="flex items-center justify-between text-sm">
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
