import { siteConfig } from "@/lib/config/site";

type BrandSize = "xs" | "sm" | "md" | "lg";

interface BrandProps {
  /** Size variant */
  size?: BrandSize;
  /** Custom class for the TLD/suffix (overrides default gradient) */
  accentClass?: string;
  /** Additional wrapper classes */
  className?: string;
  /** Show as link */
  asLink?: boolean;
}

const sizeClasses: Record<BrandSize, string> = {
  xs: "text-[10px] sm:text-xs",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
};

const defaultAccent =
  "text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-blue-600";

/**
 * Brand logo component with configurable two-tone styling
 * Uses site config for name/tld values
 */
export function Brand({
  size = "lg",
  accentClass,
  className = "",
}: BrandProps) {
  return (
    <span className={`font-bold ${sizeClasses[size]} ${className}`}>
      {siteConfig.name}
      <span className={accentClass || defaultAccent}>{siteConfig.tld}</span>
    </span>
  );
}

/**
 * Returns the brand URL format: domain/{handle}
 */
export function brandUrl(handle: string): string {
  return `${siteConfig.domain}/${handle}`;
}
