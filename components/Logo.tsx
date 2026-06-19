import { LogoIcon } from "./LogoIcon";
import { LogoText } from "./LogoText";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
type LogoVariant = "full" | "icon" | "text";

interface LogoProps {
  /** Size variant */
  size?: LogoSize;
  /** Which parts to render */
  variant?: LogoVariant;
  /** Additional classes */
  className?: string;
}

/**
 * Composable logo: icon + wordmark. Theme-aware via design tokens.
 *
 * - variant="full" (default): icon + text
 * - variant="icon": just the brand mark
 * - variant="text": just the wordmark
 */
export function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  if (variant === "icon") {
    return <LogoIcon size={size} className={className} />;
  }

  if (variant === "text") {
    return <LogoText size={size} className={className} />;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon size={size} />
      <LogoText size={size} />
    </span>
  );
}
