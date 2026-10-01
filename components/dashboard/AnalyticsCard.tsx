"use client";

import { Eye, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { MilestoneToasts } from "@/components/dashboard/MilestoneToasts";
import { Skeleton } from "@/components/ui/skeleton";
import type { Period } from "@/lib/types/api";

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

// Canvas can't read CSS variables; indigo that sits between the light and dark --brand values.
const CHART_COLOR = "#7c7ff2";

const CHART_GRID = "rgba(148,163,184,0.15)";

const CHART_HEIGHT = 200;

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
    padding: [12, 16, 0, 0],
    legend: { show: false },
    cursor: {
      x: true,
      y: false,
      drag: { x: false, y: false, setScale: false },
    },
    series: [
      {},
      {
        stroke: CHART_COLOR,
        width: 2,
        fill: (self: uPlot) => {
          const ctx = self.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, self.bbox.height / devicePixelRatio);
          gradient.addColorStop(0, `${CHART_COLOR}59`);
          gradient.addColorStop(1, `${CHART_COLOR}00`);

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
          stroke: CHART_GRID,
          dash: [2, 4],
          width: 1,
        },
        ticks: { show: false },
        // Whole-day steps only; otherwise wide charts repeat the same date label.
        incrs: [1, 2, 7, 14, 30].map((days) => days * 86_400),
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
          stroke: CHART_GRID,
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
      "background:var(--popover)",
      "color:var(--popover-foreground)",
      "border:1px solid var(--border)",
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
    viewsLine.style.color = "var(--muted-foreground)";
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

    if (!globalThis.ResizeObserver) {
      setWidth(el.clientWidth || 320);

      return;
    }

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
      ...buildChartOpts(width, CHART_HEIGHT),
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

  return <div ref={containerRef} className="w-full" style={{ height: CHART_HEIGHT }} />;
}

export function AnalyticsCard() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("7d");

  const fetchStats = useCallback(async (p: Period): Promise<AnalyticsStats> => {
    const res = await fetch(`/api/analytics/stats?period=${p}`);

    if (!res.ok) throw new Error("Failed to fetch");

    return await res.json();
  }, []);

  useEffect(() => {
    fetchStats(period).then(
      (data) => {
        setStats(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );
  }, [period, fetchStats]);

  const handlePeriodChange = (p: Period) => {
    if (p === period) return;

    setPeriod(p);
    setLoading(true);
    setError(false);
  };

  return (
    <section
      aria-label="Analytics"
      className="h-full bg-card rounded-xl border border-border p-5 md:p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
              aria-pressed={period === opt.value}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
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

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          Failed to load analytics. Try refreshing.
        </div>
      ) : stats && (stats.totalViews == null || stats.totalViews === 0) ? (
        <EmptyState />
      ) : stats ? (
        <>
          <MilestoneToasts totalViews={stats.totalViews} />
          <StatsContent stats={stats} />
        </>
      ) : null}
    </section>
  );
}

function BreakdownRows({
  rows,
  className = "",
}: {
  rows: Array<{ label: string; count: number }>;
  className?: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className={`space-y-2.5 ${className}`}>
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-muted-foreground truncate">{r.label}</span>
            <span className="font-medium text-foreground tabular-nums">{r.count}</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatsContent({ stats }: { stats: AnalyticsStats }) {
  const sources = [
    ...(stats.directVisits > 0 ? [{ label: "Direct", count: stats.directVisits }] : []),
    ...stats.topReferrers.slice(0, 3).map((r) => ({ label: r.referrer, count: r.count })),
  ];

  const devices = stats.deviceBreakdown.map((d) => ({ label: d.device, count: d.count }));

  return (
    <div className="space-y-6">
      <dl className="flex gap-10">
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            Views
          </dt>
          <dd className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatNumber(stats.totalViews)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            Visitors
          </dt>
          <dd className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatNumber(stats.uniqueVisitors)}
          </dd>
        </div>
      </dl>

      <div className="-mx-2" style={{ height: CHART_HEIGHT }}>
        <UPlotChart viewsByDay={stats.viewsByDay} />
      </div>

      <div className="grid sm:grid-cols-2 gap-6 pt-5 border-t border-border">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Traffic sources</h3>
          {sources.length > 0 ? (
            <BreakdownRows rows={sources} />
          ) : (
            <p className="text-xs text-muted-foreground/70">No traffic sources yet</p>
          )}
        </div>
        {devices.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Devices</h3>
            <BreakdownRows rows={devices} className="capitalize" />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center mb-3 bg-brand-subtle p-4 rounded-xl">
        <Eye className="w-6 h-6 text-brand" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No views yet</p>
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
      <Skeleton className="rounded-lg" style={{ height: CHART_HEIGHT }} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";

  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;

  return n.toString();
}
