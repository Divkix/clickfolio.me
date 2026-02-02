"use client";

import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface AdminSparklineProps {
  data: Array<{ date: string; views: number }>;
}

export function AdminSparkline({ data }: AdminSparklineProps) {
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

    const opts: uPlot.Options = {
      width,
      height: 80,
      padding: [8, 4, 0, 0],
      legend: { show: false },
      cursor: { show: false },
      series: [
        {},
        {
          stroke: "#6366f1",
          width: 2,
          fill: "rgba(99, 102, 241, 0.1)",
          paths: uPlot.paths.spline?.() ?? undefined,
        },
      ],
      axes: [{ show: false }, { show: false }],
    };

    chartRef.current = new uPlot(opts, [timestamps, views], el);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [width, data]);

  return <div ref={containerRef} className="w-full" style={{ height: 80 }} />;
}
