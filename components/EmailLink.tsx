"use client";

import { Mail } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

interface EmailLinkProps {
  /** The email address (used for the mailto href, rendered after mount). */
  email: string;
  /** Optional className applied to the <a> (and the SSR placeholder). */
  className?: string;
  /** Optional icon component rendered before the content. */
  icon?: ComponentType<{
    className?: string;
    size?: number;
    strokeWidth?: number;
    "aria-hidden"?: boolean;
  }>;
  /** Icon className. */
  iconClassName?: string;
  /** Icon size (passed through to the icon component). */
  iconSize?: number;
  /** Icon stroke width (passed through). */
  iconStrokeWidth?: number;
  /** Render only the content without an icon (default false). */
  hideIcon?: boolean;
  /** Custom visible content. Defaults to the email address text. */
  children?: ReactNode;
  /** Accessible label (useful for icon-only links). */
  ariaLabel?: string;
}

/**
 * Client-only email link.
 *
 * Why this exists: the public profile templates render a user's email as a
 * visible `mailto:` link in server-rendered HTML. Cloudflare's Email Address
 * Obfuscation (Scrape Shield) rewrites those emails into encoded `<span>`
 * elements + a JS blob, which React cannot reconcile on hydration →
 * minified React error #418.
 *
 * To stay obfuscation-proof regardless of the Cloudflare dashboard setting,
 * we render NO raw email in SSR: the first render outputs a neutral
 * placeholder with the same visible content (icon + label/children), and the
 * real `<a href="mailto:…">` is swapped in after mount via `useEffect`.
 * `suppressHydrationWarning` acknowledges the intentional first-paint
 * difference so React doesn't warn.
 *
 * SEO trade-off: the email is not in the raw SSR HTML, so it isn't visible to
 * naive crawlers/scrapers that don't run JS. This is the desired behavior
 * (less scraping) and is accepted.
 */
export function EmailLink({
  email,
  className,
  icon: Icon = Mail,
  iconClassName,
  iconSize,
  iconStrokeWidth,
  hideIcon = false,
  children,
  ariaLabel,
}: EmailLinkProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconEl = !hideIcon ? (
    <Icon
      className={iconClassName}
      size={iconSize}
      strokeWidth={iconStrokeWidth}
      aria-hidden={true}
    />
  ) : null;

  if (mounted) {
    return (
      <a href={`mailto:${email}`} className={className} aria-label={ariaLabel}>
        {iconEl}
        {children ?? email}
      </a>
    );
  }

  // SSR / first-paint placeholder — no raw email or mailto href in the document.
  return (
    <span suppressHydrationWarning className={className} aria-label={ariaLabel}>
      {iconEl}
      {children ?? "Email"}
    </span>
  );
}
