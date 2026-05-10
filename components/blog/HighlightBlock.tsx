import { AlertTriangle, BarChart3, Info, Lightbulb } from "lucide-react";

interface HighlightBlockProps {
  children: React.ReactNode;
  variant?: "default" | "tip" | "stat" | "warning";
  title?: string;
}

const variantStyles = {
  default: {
    bg: "bg-cream",
    border: "border-ink",
    iconColor: "text-ink",
    Icon: Info,
  },
  tip: {
    bg: "bg-mint/10",
    border: "border-mint",
    iconColor: "text-mint",
    Icon: Lightbulb,
  },
  stat: {
    bg: "bg-coral/10",
    border: "border-coral",
    iconColor: "text-coral",
    Icon: BarChart3,
  },
  warning: {
    bg: "bg-amber/10",
    border: "border-amber",
    iconColor: "text-amber",
    Icon: AlertTriangle,
  },
};

export function HighlightBlock({ children, variant = "default", title }: HighlightBlockProps) {
  const { bg, border, iconColor, Icon } = variantStyles[variant];

  return (
    <div className={`${bg} border-3 ${border} shadow-brutal-sm p-6 my-8`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          {title && <h4 className="font-bold text-ink mb-2">{title}</h4>}
          <div className="text-ink/85 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
