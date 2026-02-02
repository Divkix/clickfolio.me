"use client";

import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface AdminTrafficChartProps {
  data: Array<{ date: string; views: number; unique: number }>;
}

export function AdminTrafficChart({ data }: AdminTrafficChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width <= 0 || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const timestamps = data.map((d) => new Date(`${d.date}T00:00:00`).getTime() / 1000);
    const views = data.map((d) => d.views);
    const unique = data.map((d) => d.unique);

    const opts: uPlot.Options = {
      width,
      height: 200,
      padding: [12, 8, 0, 0],
      legend: {
        show: true,
        live: false,
      },
      cursor: {
        drag: { x: false, y: false, setScale: false },
      },
      series: [
        {},
        {
          label: "Views",
          stroke: "#6366f1",
          width: 2,
          fill: "rgba(99, 102, 241, 0.1)",
          paths: uPlot.paths.spline?.() ?? undefined,
        },
        {
          label: "Unique",
          stroke: "#10b981",
          width: 2,
          dash: [4, 4],
          paths: uPlot.paths.spline?.() ?? undefined,
        },
      ],
      axes: [
        {
          stroke: "#94a3b8",
          font: "11px system-ui, sans-serif",
          grid: { stroke: "rgba(0,0,0,0.05)", width: 1 },
          ticks: { show: false },
          values: (_self: uPlot, ticks: number[]) =>
            ticks.map((t) => {
              const d = new Date(t * 1000);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }),
        },
        {
          stroke: "#94a3b8",
          font: "11px system-ui, sans-serif",
          grid: { stroke: "rgba(0,0,0,0.05)", width: 1 },
          ticks: { show: false },
        },
      ],
    };

    chartRef.current = new uPlot(opts, [timestamps, views, unique], el);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [width, data]);

  return <div ref={containerRef} className="w-full" style={{ height: 200 }} />;
}
