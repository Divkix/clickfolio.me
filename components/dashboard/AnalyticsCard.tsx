"use client";

import { Eye, Globe, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "7d" | "30d" | "90d";

interface AnalyticsStats {
  totalViews: number;
  uniqueVisitors: number;
  viewsByDay: Array<{ date: string; views: number; uniques: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  directVisits: number;
  deviceBreakdown: Array<{ device: string; count: number }>;
  countryBreakdown: Array<{ country: string; count: number }>;
  period: string;
}

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export function AnalyticsCard() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("7d");

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/analytics/stats?period=${p}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AnalyticsStats = await res.json();
      setStats(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  return (
    <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6 hover:shadow-depth-md transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Analytics</h3>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
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

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="text-sm text-slate-500 text-center py-8">
          Failed to load analytics. Try refreshing.
        </div>
      ) : stats && stats.totalViews === 0 ? (
        <EmptyState />
      ) : stats ? (
        <StatsContent stats={stats} />
      ) : null}
    </div>
  );
}

function StatsContent({ stats }: { stats: AnalyticsStats }) {
  const topReferrers = stats.topReferrers.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Big Numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg blur-md opacity-20" />
            <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-2 rounded-lg">
              <Eye className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Views</p>
            <p className="text-lg font-bold text-slate-900">{formatNumber(stats.totalViews)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-lg blur-md opacity-20" />
            <div className="relative bg-linear-to-r from-emerald-100 to-teal-100 p-2 rounded-lg">
              <Users className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Visitors</p>
            <p className="text-lg font-bold text-slate-900">{formatNumber(stats.uniqueVisitors)}</p>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[160px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.viewsByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatChartDate(d)}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#6366f1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#viewsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Traffic Sources */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Traffic Sources
        </p>
        <div className="space-y-1.5">
          {stats.directVisits > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Direct</span>
              <span className="font-medium text-slate-900">{stats.directVisits}</span>
            </div>
          )}
          {topReferrers.map((r) => (
            <div key={r.referrer} className="flex items-center justify-between text-sm">
              <span className="text-slate-600 truncate max-w-[140px]">{r.referrer}</span>
              <span className="font-medium text-slate-900">{r.count}</span>
            </div>
          ))}
          {stats.directVisits === 0 && topReferrers.length === 0 && (
            <p className="text-xs text-slate-400">No traffic sources yet</p>
          )}
        </div>
      </div>

      {/* Device Breakdown */}
      {stats.deviceBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Devices
          </p>
          <div className="flex gap-3">
            {stats.deviceBreakdown.map((d) => {
              const Icon = DEVICE_ICONS[d.device] || Globe;
              return (
                <div key={d.device} className="flex items-center gap-1.5 text-sm">
                  <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span className="text-slate-600 capitalize">{d.device}</span>
                  <span className="font-medium text-slate-900">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-medium">{formatTooltipDate(label)}</p>
      <p className="text-slate-300">
        {payload[0].value} view{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="relative inline-block mb-3">
        <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl blur-lg opacity-20" />
        <div className="relative bg-linear-to-r from-indigo-100 to-blue-100 p-4 rounded-xl">
          <Eye className="w-6 h-6 text-indigo-600" aria-hidden="true" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-700 mb-1">No views yet</p>
      <p className="text-xs text-slate-500">Share your resume link to start tracking visits.</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-[160px] rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatChartDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number.parseInt(month, 10)}/${Number.parseInt(day, 10)}`;
}

function formatTooltipDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
