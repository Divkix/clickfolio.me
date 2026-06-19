type LogoIconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoIconProps {
  /** Size variant */
  size?: LogoIconSize;
  /** Additional classes */
  className?: string;
}

const sizeConfig: Record<LogoIconSize, number> = {
  xs: 18,
  sm: 24,
  md: 30,
  lg: 44,
  xl: 60,
};

/**
 * Icon-only brand mark — a rounded tile with a document and brand lightning bolt.
 * Theme-aware: the tile inherits `currentColor`, the bolt uses the brand token.
 */
export function LogoIcon({ size = "md", className = "" }: LogoIconProps) {
  const dimension = sizeConfig[size];

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="clickfolio.me icon"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG with role="img" is correct ARIA pattern
      role="img"
    >
      <rect x="1" y="1" width="38" height="38" rx="9" className="fill-foreground" />
      <path
        d="M13 11h9M13 17h7M13 23h5"
        stroke="var(--color-background)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="m25 9-5 12h5l-5 11"
        stroke="var(--color-brand)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
