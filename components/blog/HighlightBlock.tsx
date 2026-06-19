import { AlertTriangle, BarChart3, Info, Lightbulb } from "lucide-react";

interface HighlightBlockProps {
  children: React.ReactNode;
  variant?: "default" | "tip" | "stat" | "warning";
  title?: string;
}

const variantStyles = {
  default: {
    bg: "bg-card border-border",
    iconColor: "text-muted-foreground",
    Icon: Info,
  },
  tip: {
    bg: "bg-success/10 border-success/30",
    iconColor: "text-success",
    Icon: Lightbulb,
  },
  stat: {
    bg: "bg-brand-subtle border-brand/30",
    iconColor: "text-brand",
    Icon: BarChart3,
  },
  warning: {
    bg: "bg-warning/10 border-warning/30",
    iconColor: "text-warning",
    Icon: AlertTriangle,
  },
};

export function HighlightBlock({ children, variant = "default", title }: HighlightBlockProps) {
  const { bg, iconColor, Icon } = variantStyles[variant];

  return (
    <div className={`${bg} rounded-xl border shadow-sm p-6 my-8`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} aria-hidden="true" />
        <div className="flex-1">
          {title && <h4 className="font-semibold text-foreground mb-2">{title}</h4>}
          <div className="text-muted-foreground leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
