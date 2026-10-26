import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ValidateLinkOptions } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

interface StatCardProps<TOptions = unknown> {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  change?: number;
  linkOptions?: ValidateLinkOptions<RegisteredRouter, TOptions>;
}

export function StatCard<TOptions>(props: StatCardProps<TOptions>): ReactNode;
export function StatCard({
  title,
  value,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  change,
  linkOptions,
}: StatCardProps) {
  // SAFETY: zod safeParse guarantees value is number/string before cast; preserves validated type.
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
              {z.number().safeParse(value).success
                ? (value as number).toLocaleString()
                : (value as string)}
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

  if (linkOptions) {
    return (
      <Link {...linkOptions} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
