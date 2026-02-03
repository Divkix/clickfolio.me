"use client";

import { BarChart3, Eye, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminTrafficChart } from "@/components/admin/AdminTrafficChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "7d" | "30d" | "90d";

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

const COUNTRY_FLAGS: Record<string, string> = {
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
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");

  const fetchAnalytics = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${p}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(period);
  }, [period, fetchAnalytics]);

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-slate-400" aria-hidden="true" />
          <span className="text-sm text-slate-500">Platform Analytics</span>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === opt.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Total Views"
              value={data?.totals.views ?? 0}
              icon={Eye}
              iconColorClass="text-coral"
              iconBgClass="bg-linear-to-r from-coral/20 to-coral/20"
              change={data?.changes.views}
            />
            <StatCard
              title="Unique Visitors"
              value={data?.totals.unique ?? 0}
              icon={Users}
              iconColorClass="text-emerald-600"
              iconBgClass="bg-linear-to-r from-emerald-100 to-teal-100"
              change={data?.changes.unique}
            />
            <StatCard
              title="Avg/Day"
              value={data?.totals.avgPerDay ?? 0}
              icon={TrendingUp}
              iconColorClass="text-amber-600"
              iconBgClass="bg-linear-to-r from-amber-100 to-orange-100"
              change={data?.changes.avgPerDay}
            />
            <StatCard
              title="Profiles Viewed"
              value={data?.totals.profilesViewed ?? 0}
              icon={BarChart3}
              iconColorClass="text-purple-600"
              iconBgClass="bg-linear-to-r from-purple-100 to-pink-100"
            />
          </>
        )}
      </div>

      {/* Traffic Chart */}
      <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Platform Traffic
        </h2>
        {loading ? (
          <Skeleton className="h-[200px] rounded-lg" />
        ) : data ? (
          <AdminTrafficChart data={data.daily} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Profiles */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Top Profiles
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : data?.topProfiles.length === 0 ? (
            <p className="text-sm text-slate-400">No profile views yet</p>
          ) : (
            <div className="space-y-2">
              {data?.topProfiles.map((profile, i) => (
                <div key={profile.handle} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 w-6">{i + 1}.</span>
                    <Link
                      href={`/${profile.handle}`}
                      target="_blank"
                      className="text-sm text-coral hover:text-coral"
                    >
                      @{profile.handle}
                    </Link>
                  </div>
                  <span
                    className="text-sm font-medium text-slate-900"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {profile.views.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traffic Sources */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Traffic Sources
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <HorizontalBarChart
              items={
                data?.referrers.map((r) => ({
                  label: r.domain,
                  value: r.count,
                  percent: r.percent,
                })) ?? []
              }
              colorClass="bg-coral"
            />
          )}
        </div>

        {/* Countries */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Top Countries
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : data?.countries.length === 0 ? (
            <p className="text-sm text-slate-400">No country data yet</p>
          ) : (
            <div className="space-y-2">
              {data?.countries.map((c) => (
                <div key={c.code} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {COUNTRY_FLAGS[c.code] || "\u{1F3F3}"} {c.name}
                  </span>
                  <span
                    className="text-sm font-medium text-slate-900"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {c.percent}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Devices
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <HorizontalBarChart
              items={
                data?.devices.map((d) => ({
                  label: d.type.charAt(0).toUpperCase() + d.type.slice(1),
                  value: 0,
                  percent: d.percent,
                })) ?? []
              }
              colorClass="bg-amber-500"
            />
          )}
        </div>
      </div>
    </div>
  );
}
