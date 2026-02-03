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
    <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-4 hover:shadow-depth-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={`absolute inset-0 ${iconBgClass} rounded-lg blur-md opacity-20`} />
          <div className={`relative ${iconBgClass} p-2.5 rounded-lg`}>
            <Icon className={`w-5 h-5 ${iconColorClass}`} aria-hidden="true" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            <p
              className="text-xl font-bold text-slate-900"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {change !== undefined && (
              <span
                className={`text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-coral"}`}
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
