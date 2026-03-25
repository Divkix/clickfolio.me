import type React from "react";

export type BrandIconVariant = "black" | "white";

export interface BrandIconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  title?: string;
  "aria-hidden"?: boolean;
  variant?: BrandIconVariant;
}

interface BrandAssetProps extends Omit<BrandIconProps, "variant"> {
  src: string;
  alt: string;
}

function BrandAsset({
  src,
  alt,
  className,
  size = 24,
  style,
  title,
  "aria-hidden": ariaHidden,
}: BrandAssetProps) {
  const decorative = ariaHidden ?? !title;
  const resolvedAlt = decorative ? "" : (title ?? alt);
  const resolvedClassName = ["inline-block shrink-0 align-middle object-contain", className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      src={src}
      alt={resolvedAlt}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      className={resolvedClassName}
      style={style}
      decoding="async"
      draggable={false}
    />
  );
}

export function GitHubIcon({ variant = "black", ...props }: BrandIconProps) {
  const src =
    variant === "white"
      ? "/brand/github/invertocat-white.svg"
      : "/brand/github/invertocat-black.svg";

  return <BrandAsset src={src} alt="GitHub" {...props} />;
}

export function LinkedInIcon({ variant = "black", ...props }: BrandIconProps) {
  const src =
    variant === "white" ? "/brand/linkedin/inbug-white.png" : "/brand/linkedin/inbug-black.png";

  return <BrandAsset src={src} alt="LinkedIn" {...props} />;
}

export function Github(props: BrandIconProps) {
  return <GitHubIcon {...props} />;
}

export function Linkedin(props: BrandIconProps) {
  return <LinkedInIcon {...props} />;
}
