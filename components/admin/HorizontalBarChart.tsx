interface BarItem {
  label: string;
  value: number;
  percent: number;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  colorClass?: string;
}

export function HorizontalBarChart({ items, colorClass = "bg-coral" }: HorizontalBarChartProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No data available</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-slate-600 w-32 truncate" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colorClass} rounded-full transition-all duration-300`}
              style={{ width: `${Math.max(item.percent, 2)}%` }}
            />
          </div>
          <span
            className="text-sm text-slate-900 font-medium w-12 text-right"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {item.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}
