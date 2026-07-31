"use client";

import { useEffect, useState } from "react";

interface ObfuscatedTextProps {
  /** The sensitive text (e.g. an email address) to keep out of SSR HTML. */
  text: string;
  /** Optional className for the wrapper span. */
  className?: string;
  /**
   * Placeholder shown in SSR / before mount. Defaults to "••••" so the
   * layout reserves roughly the same space as the real text.
   */
  placeholder?: string;
}

/**
 * Renders sensitive text (typically an email address) only after client mount.
 *
 * The first (server) render outputs a neutral placeholder so the raw value
 * never appears in the SSR HTML — this defeats Cloudflare Email Address
 * Obfuscation, which rewrites visible email text into encoded `<span>`s that
 * React cannot reconcile (minified error #418). After mount the real text
 * swaps in. `suppressHydrationWarning` acknowledges the intentional
 * first-paint difference.
 *
 * Use for the visible text of an email; the surrounding `mailto:` `<a>` href
 * may remain in SSR (Cloudflare rewrites the href *attribute*, which React
 * patches silently — that does not trigger #418).
 */
export function ObfuscatedText({ text, className, placeholder = "••••" }: ObfuscatedTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span suppressHydrationWarning className={className}>
      {mounted ? text : placeholder}
    </span>
  );
}
