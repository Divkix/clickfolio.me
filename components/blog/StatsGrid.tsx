interface StatItem {
  value: string;
  label: string;
  percentage?: number;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 1 | 2;
}

export function StatsGrid({ stats, columns = 2 }: StatsGridProps) {
  const gridCols = columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`grid ${gridCols} gap-4 my-8`}>
      {stats.map((stat, index) => (
        <div key={index} className="rounded-xl border border-border bg-card shadow-sm p-5">
          <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
          <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
          {stat.percentage !== undefined && (
            <div className="mt-3">
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
