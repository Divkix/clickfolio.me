import { cn } from "@/lib/utils/cn";

type LogoSize = "xs" | "sm" | "md";

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

const iconSizes: Record<LogoSize, number> = { xs: 18, sm: 24, md: 30 };
const textSizes: Record<LogoSize, string> = { xs: "text-base", sm: "text-lg", md: "text-xl" };

export function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={iconSizes[size]}
        height={iconSizes[size]}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
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
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-foreground",
          textSizes[size],
        )}
      >
        clickfolio<span className="text-brand">.me</span>
      </span>
    </span>
  );
}
