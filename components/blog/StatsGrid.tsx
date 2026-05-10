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
        <div
          key={`${stat.label}-${stat.value}-${index}`}
          className="bg-cream border-3 border-ink shadow-brutal-sm p-5"
        >
          <div className="font-black text-3xl text-ink mb-1">{stat.value}</div>
          <div className="text-sm text-ink/70 font-medium">{stat.label}</div>
          {stat.percentage !== undefined && (
            <div className="mt-3">
              <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-coral rounded-full"
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
