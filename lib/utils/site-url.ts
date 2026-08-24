/**
 * Site URL resolution utility.
 *
 * Returns the public-facing site URL from APP_URL,
 * falling back to the production default.
 */
import { siteConfig } from "@/lib/config/site";

const DEFAULT_PUBLIC_SITE_URL = siteConfig.url;

/**
 * Returns the public site URL for canonical links and redirects.
 *
 * Uses APP_URL env var when available; otherwise falls back
 * to the production default (siteConfig.url). Trailing slashes are
 * stripped so URL concatenation (e.g. `${url}/sitemap.xml`) never produces
 * double slashes.
 *
 * @returns Fully qualified public site URL (no trailing slash)
 */
export function getPublicSiteUrl(): string {
  return (process.env.APP_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}
