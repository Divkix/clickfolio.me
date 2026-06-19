import { cn } from "@/lib/utils/cn";

type LogoTextSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoTextProps {
  /** Size variant */
  size?: LogoTextSize;
  /** Additional classes */
  className?: string;
}

const sizeConfig: Record<LogoTextSize, string> = {
  xs: "text-base",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

/**
 * Wordmark — "clickfolio" inherits the surrounding text color (theme-aware),
 * ".me" is rendered in the brand color. No rotation or offset shadows.
 */
export function LogoText({ size = "md", className = "" }: LogoTextProps) {
  return (
    <span
      className={cn(
        "font-display font-extrabold tracking-tight text-foreground",
        sizeConfig[size],
        className,
      )}
    >
      clickfolio<span className="text-brand">.me</span>
    </span>
  );
}
