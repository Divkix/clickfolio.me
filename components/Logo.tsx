import { LogoIcon } from "./LogoIcon";
import { LogoText } from "./LogoText";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
type LogoVariant = "full" | "icon" | "text";
type LogoColorScheme = "dark" | "light";

interface LogoProps {
  /** Size variant */
  size?: LogoSize;
  /** Which parts to render */
  variant?: LogoVariant;
  /** Color scheme for different backgrounds */
  colorScheme?: LogoColorScheme;
  /** Additional classes */
  className?: string;
}

// Size mappings for composed layout
const iconSizeMap: Record<LogoSize, "xs" | "sm" | "md" | "lg" | "xl"> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

const textSizeMap: Record<LogoSize, "xs" | "sm" | "md" | "lg" | "xl"> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

const gapMap: Record<LogoSize, string> = {
  xs: "gap-0",
  sm: "gap-0",
  md: "gap-0",
  lg: "gap-0",
  xl: "gap-0.5",
};

/**
 * Composable logo component
 *
 * - variant="full" (default): Icon + Text
 * - variant="icon": Just the document icon
 * - variant="text": Just the text with badge
 */
export function Logo({
  size = "md",
  variant = "full",
  colorScheme = "dark",
  className = "",
}: LogoProps) {
  if (variant === "icon") {
    return <LogoIcon size={iconSizeMap[size]} colorScheme={colorScheme} className={className} />;
  }

  if (variant === "text") {
    return <LogoText size={textSizeMap[size]} colorScheme={colorScheme} className={className} />;
  }

  // Full logo: compose icon + text
  return (
    <div className={`inline-flex items-center ${gapMap[size]} ${className}`}>
      <LogoIcon size={iconSizeMap[size]} colorScheme={colorScheme} />
      <LogoText size={textSizeMap[size]} colorScheme={colorScheme} />
    </div>
  );
}
