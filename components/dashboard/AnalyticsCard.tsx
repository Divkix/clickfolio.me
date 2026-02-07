"use client";

import { Eye, Globe, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { MilestoneToasts } from "@/components/dashboard/MilestoneToasts";
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

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toUPlotData(viewsByDay: Array<{ date: string; views: number }>): [number[], number[]] {
  const timestamps: number[] = [];
  const views: number[] = [];
  for (const entry of viewsByDay) {
    timestamps.push(new Date(`${entry.date}T00:00:00`).getTime() / 1000);
    views.push(entry.views);
  }
  return [timestamps, views];
}

function buildChartOpts(width: number, height: number): uPlot.Options {
  return {
    width,
    height,
    padding: [12, 8, 0, 0],
    legend: { show: false },
    cursor: {
      x: true,
      y: false,
      drag: { x: false, y: false, setScale: false },
    },
    series: [
      {},
      {
        stroke: "#ef4444",
        width: 2,
        fill: (self: uPlot) => {
          const ctx = self.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, self.bbox.height / devicePixelRatio);
          gradient.addColorStop(0, "#ef444480");
          gradient.addColorStop(1, "#ef444400");
          return gradient;
        },
        paths: uPlot.paths.spline?.() ?? undefined,
      },
    ],
    axes: [
      {
        stroke: "#94a3b8",
        font: "10px system-ui, sans-serif",
        grid: {
          stroke: "rgba(255,255,255,0.06)",
          dash: [2, 4],
          width: 1,
        },
        ticks: { show: false },
        values: (_self: uPlot, ticks: number[]) =>
          ticks.map((t) => {
            const d = new Date(t * 1000);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }),
      },
      {
        stroke: "#94a3b8",
        font: "10px system-ui, sans-serif",
        grid: {
          stroke: "rgba(255,255,255,0.06)",
          dash: [2, 4],
          width: 1,
        },
        ticks: { show: false },
        values: (_self: uPlot, ticks: number[]) =>
          ticks.map((v) => (Number.isInteger(v) ? String(v) : "")),
      },
    ],
  };
}

function tooltipPlugin(): uPlot.Plugin {
  let tooltip: HTMLDivElement | null = null;
  let dateLine: HTMLDivElement | null = null;
  let viewsLine: HTMLDivElement | null = null;

  function init(u: uPlot) {
    tooltip = document.createElement("div");
    tooltip.style.cssText = [
      "display:none",
      "position:absolute",
      "pointer-events:none",
      "background:#0f172a",
      "color:#fff",
      "font-size:12px",
      "border-radius:8px",
      "padding:6px 10px",
      "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
      "z-index:100",
      "white-space:nowrap",
    ].join(";");

    dateLine = document.createElement("div");
    dateLine.style.fontWeight = "500";
    tooltip.appendChild(dateLine);

    viewsLine = document.createElement("div");
    viewsLine.style.color = "#cbd5e1";
    tooltip.appendChild(viewsLine);

    u.over.appendChild(tooltip);
  }

  function setCursor(u: uPlot) {
    if (!tooltip || !dateLine || !viewsLine) return;
    const idx = u.cursor.idx;
    if (idx == null || idx < 0) {
      tooltip.style.display = "none";
      return;
    }

    const ts = u.data[0][idx];
    const val = u.data[1][idx];
    if (ts == null || val == null) {
      tooltip.style.display = "none";
      return;
    }

    const d = new Date(ts * 1000);
    const dateStr = `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    const viewLabel = val === 1 ? "view" : "views";

    dateLine.textContent = dateStr;
    viewsLine.textContent = `${val} ${viewLabel}`;
    tooltip.style.display = "block";

    const left = u.cursor.left ?? 0;
    const top = u.cursor.top ?? 0;
    const tooltipW = tooltip.offsetWidth;
    const overW = u.over.offsetWidth;

    let posX = left + 10;
    if (posX + tooltipW > overW) {
      posX = left - tooltipW - 10;
    }

    tooltip.style.left = `${posX}px`;
    tooltip.style.top = `${Math.max(0, top - 40)}px`;
  }

  return {
    hooks: {
      init,
      setCursor,
    },
  };
}

function UPlotChart({ viewsByDay }: { viewsByDay: Array<{ date: string; views: number }> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) {
          setWidth(Math.floor(cr.width));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width <= 0 || viewsByDay.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const opts: uPlot.Options = {
      ...buildChartOpts(width, 160),
      plugins: [tooltipPlugin()],
    };
    const data = toUPlotData(viewsByDay);

    chartRef.current = new uPlot(opts, data, el);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [width, viewsByDay]);

  return <div ref={containerRef} className="w-full" style={{ height: 160 }} />;
}

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
    <div className="bg-card rounded-xl shadow-sm border border-ink/10 p-6 hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/80"
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
        <div className="text-sm text-muted-foreground text-center py-8">
          Failed to load analytics. Try refreshing.
        </div>
      ) : stats && stats.totalViews === 0 ? (
        <EmptyState />
      ) : stats ? (
        <>
          <MilestoneToasts totalViews={stats.totalViews} />
          <StatsContent stats={stats} />
        </>
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
            <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-lg blur-md opacity-20" />
            <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-2 rounded-lg">
              <Eye className="w-4 h-4 text-coral" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Views</p>
            <p className="text-lg font-bold text-foreground">{formatNumber(stats.totalViews)}</p>
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
            <p className="text-xs font-medium text-muted-foreground">Visitors</p>
            <p className="text-lg font-bold text-foreground">
              {formatNumber(stats.uniqueVisitors)}
            </p>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[160px] -mx-2">
        <UPlotChart viewsByDay={stats.viewsByDay} />
      </div>

      {/* Traffic Sources */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Traffic Sources
        </p>
        <div className="space-y-1.5">
          {stats.directVisits > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Direct</span>
              <span className="font-medium text-foreground">{stats.directVisits}</span>
            </div>
          )}
          {topReferrers.map((r) => (
            <div key={r.referrer} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate max-w-[140px]">{r.referrer}</span>
              <span className="font-medium text-foreground">{r.count}</span>
            </div>
          ))}
          {stats.directVisits === 0 && topReferrers.length === 0 && (
            <p className="text-xs text-muted-foreground/70">No traffic sources yet</p>
          )}
        </div>
      </div>

      {/* Device Breakdown */}
      {stats.deviceBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Devices
          </p>
          <div className="flex gap-3">
            {stats.deviceBreakdown.map((d) => {
              const Icon = DEVICE_ICONS[d.device] || Globe;
              return (
                <div key={d.device} className="flex items-center gap-1.5 text-sm">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/70" aria-hidden="true" />
                  <span className="text-muted-foreground capitalize">{d.device}</span>
                  <span className="font-medium text-foreground">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="relative inline-block mb-3">
        <div className="absolute inset-0 bg-linear-to-r from-coral to-coral rounded-xl blur-lg opacity-20" />
        <div className="relative bg-linear-to-r from-coral/20 to-coral/20 p-4 rounded-xl">
          <Eye className="w-6 h-6 text-coral" aria-hidden="true" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground/80 mb-1">No views yet</p>
      <p className="text-xs text-muted-foreground">
        Share your resume link to start tracking visits.
      </p>
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
