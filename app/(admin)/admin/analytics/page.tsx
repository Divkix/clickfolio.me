"use client";

export const revalidate = 86400;

import { BarChart3, Eye, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { AdminTrafficChart } from "@/components/admin/AdminTrafficChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Period } from "@/lib/types/api";

interface AnalyticsData {
  totals: {
    views: number;
    unique: number;
    avgPerDay: number;
    profilesViewed: number;
  };
  changes: {
    views: number;
    unique: number;
    avgPerDay: number;
  };
  daily: Array<{ date: string; views: number; unique: number }>;
  topProfiles: Array<{ handle: string; views: number }>;
  referrers: Array<{ domain: string; count: number; percent: number }>;
  countries: Array<{ code: string; name: string; percent: number }>;
  devices: Array<{ type: string; percent: number }>;
}

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
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

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");

  const fetchAnalytics = useCallback((p: Period) => {
    return fetch(`/api/admin/analytics?period=${p}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        const json: AnalyticsData = await res.json();
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch analytics:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void fetchAnalytics(period);
  }, [period, fetchAnalytics]);

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
              onClick={() => {
                setPeriod(opt.value);
                setLoading(true);
              }}
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
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard
              title="Total Views"
              value={data?.totals.views ?? 0}
              icon={Eye}
              iconColorClass="text-brand"
              iconBgClass="bg-brand-subtle"
              change={data?.changes.views}
            />
            <StatCard
              title="Unique Visitors"
              value={data?.totals.unique ?? 0}
              icon={Users}
              iconColorClass="text-muted-foreground"
              iconBgClass="bg-surface-2"
              change={data?.changes.unique}
            />
            <StatCard
              title="Avg/Day"
              value={data?.totals.avgPerDay ?? 0}
              icon={TrendingUp}
              iconColorClass="text-muted-foreground"
              iconBgClass="bg-surface-2"
              change={data?.changes.avgPerDay}
            />
            <StatCard
              title="Profiles Viewed"
              value={data?.totals.profilesViewed ?? 0}
              icon={BarChart3}
              iconColorClass="text-muted-foreground"
              iconBgClass="bg-surface-2"
            />
          </>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Platform Traffic
        </h2>
        {loading ? (
          <Skeleton className="h-[200px] rounded-lg" />
        ) : data ? (
          <AdminTrafficChart data={data.daily} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProfilesPanel data={data} loading={loading} />
        <TrafficSourcesPanel data={data} loading={loading} />
        <TopCountriesPanel data={data} loading={loading} />
        <DevicesPanel data={data} loading={loading} />
      </div>
    </div>
  );
}

interface PanelProps {
  data: AnalyticsData | null;
  loading: boolean;
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

function PanelsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-6" />
      ))}
    </div>
  );
}

function TopProfilesPanel({ data, loading }: PanelProps) {
  return (
    <ChartPanel title="Top Profiles">
      {loading ? (
        <PanelsSkeleton rows={5} />
      ) : data?.topProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">No profile views yet</p>
      ) : (
        <div className="space-y-2">
          {data?.topProfiles.map((profile, i) => (
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

function TrafficSourcesPanel({ data, loading }: PanelProps) {
  return (
    <ChartPanel title="Traffic Sources">
      {loading ? (
        <PanelsSkeleton rows={5} />
      ) : (
        <HorizontalBarChart
          items={
            data?.referrers.map((r) => ({
              label: r.domain,
              value: r.count,
              percent: r.percent,
            })) ?? []
          }
          colorClass="bg-brand"
        />
      )}
    </ChartPanel>
  );
}

function TopCountriesPanel({ data, loading }: PanelProps) {
  return (
    <ChartPanel title="Top Countries">
      {loading ? (
        <PanelsSkeleton rows={5} />
      ) : data?.countries.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">No country data yet</p>
      ) : (
        <div className="space-y-2">
          {data?.countries.map((c) => {
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

function DevicesPanel({ data, loading }: PanelProps) {
  return (
    <ChartPanel title="Devices">
      {loading ? (
        <PanelsSkeleton rows={3} />
      ) : (
        <HorizontalBarChart
          items={
            data?.devices.map((d) => ({
              label: d.type.charAt(0).toUpperCase() + d.type.slice(1),
              value: 0,
              percent: d.percent,
            })) ?? []
          }
          colorClass="bg-chart-2"
        />
      )}
    </ChartPanel>
  );
}
