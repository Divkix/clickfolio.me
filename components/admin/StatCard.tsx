import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  change?: number;
  href?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  change,
  href,
}: StatCardProps) {
  const content = (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 transition-colors hover:border-border-strong">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 ${iconBgClass} p-2.5 rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColorClass}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            <p
              className="text-xl font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {change !== undefined && (
              <span
                className={`text-xs font-medium ${change >= 0 ? "text-success" : "text-destructive"}`}
              >
                {change >= 0 ? "+" : ""}
                {change}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}
