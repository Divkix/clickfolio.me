type LogoIconSize = "xs" | "sm" | "md" | "lg" | "xl";
type LogoIconColorScheme = "dark" | "light";

interface LogoIconProps {
  /** Size variant */
  size?: LogoIconSize;
  /** Color scheme for different backgrounds */
  colorScheme?: LogoIconColorScheme;
  /** Additional classes */
  className?: string;
}

const sizeConfig: Record<LogoIconSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

const colorConfig: Record<
  LogoIconColorScheme,
  { shadow: string; document: string; documentStroke: string; lines: string; lightning: string }
> = {
  dark: {
    shadow: "#0d0d0d",
    document: "#fdf8f3",
    documentStroke: "#0d0d0d",
    lines: "#0d0d0d",
    lightning: "#d94e4e",
  },
  light: {
    shadow: "#0d0d0d",
    document: "#fdf8f3",
    documentStroke: "#0d0d0d",
    lines: "#0d0d0d",
    lightning: "#d94e4e",
  },
};

/**
 * Icon-only version of the logo (cream document with lightning bolt)
 * Use for favicons, small spaces, or alongside text
 */
export function LogoIcon({ size = "md", colorScheme = "dark", className = "" }: LogoIconProps) {
  const dimension = sizeConfig[size];
  const colors = colorConfig[colorScheme];

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 44 44"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="clickfolio.me icon"
      role="img"
    >
      {/* Shadow layer */}
      <rect x="3" y="3" width="40" height="40" rx="4" fill={colors.shadow} />

      {/* Cream document */}
      <rect
        x="0"
        y="0"
        width="40"
        height="40"
        rx="4"
        fill={colors.document}
        stroke={colors.documentStroke}
        strokeWidth="3"
      />

      {/* Fold line diagonal */}
      <path d="m22 0-8 40" stroke={colors.documentStroke} strokeWidth="3" />

      {/* Black text lines */}
      <path
        stroke={colors.lines}
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M6 10h10M6 18h8M6 26h6"
      />

      {/* Coral lightning bolt */}
      <path
        d="m26 6 6 12h-6l6 12"
        stroke={colors.lightning}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
