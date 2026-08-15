import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function FormSectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="shrink-0 bg-brand-subtle p-2.5 rounded-lg">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
