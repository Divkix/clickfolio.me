"use client";

import { BarChart3, Eye, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminTrafficChart } from "@/components/admin/AdminTrafficChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { StatCard } from "@/components/admin/StatCard";
import type { AdminAnalyticsData, AnalyticsPeriod } from "@/lib/data/admin-analytics";

const PERIOD_OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const COUNTRY_FLAGS = {
  US: "\u{1F1FA}\u{1F1F8}",
  GB: "\u{1F1EC}\u{1F1E7}",
  DE: "\u{1F1E9}\u{1F1EA}",
  CA: "\u{1F1E8}\u{1F1E6}",
  IN: "\u{1F1EE}\u{1F1F3}",
  FR: "\u{1F1EB}\u{1F1F7}",
  AU: "\u{1F1E6}\u{1F1FA}",
  BR: "\u{1F1E7}\u{1F1F7}",
  JP: "\u{1F1EF}\u{1F1F5}",
  MX: "\u{1F1F2}\u{1F1FD}",
} as const satisfies Record<string, string>;

export default function AnalyticsClient({
  data,
  period,
}: {
  data: AdminAnalyticsData;
  period: AnalyticsPeriod;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Platform Analytics</span>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => router.push(`/admin/analytics?period=${opt.value}`)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <>
          <StatCard
            title="Total Views"
            value={data.totals.views}
            icon={Eye}
            iconColorClass="text-brand"
            iconBgClass="bg-brand-subtle"
            change={data.changes.views}
          />
          <StatCard
            title="Unique Visitors"
            value={data.totals.unique}
            icon={Users}
            iconColorClass="text-muted-foreground"
            iconBgClass="bg-surface-2"
            change={data.changes.unique}
          />
          <StatCard
            title="Avg/Day"
            value={data.totals.avgPerDay}
            icon={TrendingUp}
            iconColorClass="text-muted-foreground"
            iconBgClass="bg-surface-2"
            change={data.changes.avgPerDay}
          />
          <StatCard
            title="Profiles Viewed"
            value={data.totals.profilesViewed}
            icon={BarChart3}
            iconColorClass="text-muted-foreground"
            iconBgClass="bg-surface-2"
          />
        </>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Platform Traffic
        </h2>
        <AdminTrafficChart data={data.daily} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProfilesPanel data={data} />
        <TrafficSourcesPanel data={data} />
        <TopCountriesPanel data={data} />
        <DevicesPanel data={data} />
      </div>
    </div>
  );
}

interface PanelProps {
  data: AdminAnalyticsData;
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function TopProfilesPanel({ data }: PanelProps) {
  return (
    <ChartPanel title="Top Profiles">
      {data.topProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">No profile views yet</p>
      ) : (
        <div className="space-y-2">
          {data.topProfiles.map((profile, i) => (
            <div key={profile.handle} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground/70 w-6">{i + 1}.</span>
                <Link
                  href={`/@${profile.handle}`}
                  target="_blank"
                  className="text-sm font-mono text-brand hover:underline"
                >
                  @{profile.handle}
                </Link>
              </div>
              <span
                className="text-sm font-medium text-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {profile.views.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </ChartPanel>
  );
}

function TrafficSourcesPanel({ data }: PanelProps) {
  return (
    <ChartPanel title="Traffic Sources">
      {
        <HorizontalBarChart
          items={data.referrers.map((r) => ({
            label: r.domain,
            value: r.count,
            percent: r.percent,
          }))}
          colorClass="bg-brand"
        />
      }
    </ChartPanel>
  );
}

function TopCountriesPanel({ data }: PanelProps) {
  return (
    <ChartPanel title="Top Countries">
      {data.countries.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">No country data yet</p>
      ) : (
        <div className="space-y-2">
          {data.countries.map((c) => {
            // SAFETY: c.code is a country code string; COUNTRY_FLAGS covers common codes with fallback.
            const flag = COUNTRY_FLAGS[c.code as keyof typeof COUNTRY_FLAGS] || "\u{1F3F3}";

            return (
              <div key={c.code} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {flag} {c.name}
                </span>
                <span
                  className="text-sm font-medium text-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {c.percent}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ChartPanel>
  );
}

function DevicesPanel({ data }: PanelProps) {
  return (
    <ChartPanel title="Devices">
      {
        <HorizontalBarChart
          items={data.devices.map((d) => ({
            label: d.type.charAt(0).toUpperCase() + d.type.slice(1),
            value: 0,
            percent: d.percent,
          }))}
          colorClass="bg-chart-2"
        />
      }
    </ChartPanel>
  );
}
