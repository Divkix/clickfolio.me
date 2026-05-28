/**
 * Site URL resolution utility.
 *
 * Returns the public-facing site URL from BETTER_AUTH_URL,
 * falling back to the production default.
 */

const DEFAULT_PUBLIC_SITE_URL = "https://clickfolio.me";

/**
 * Returns the public site URL for canonical links and redirects.
 *
 * Uses BETTER_AUTH_URL env var when available; otherwise falls back
 * to the production default https://clickfolio.me.
 *
 * @returns Fully qualified public site URL (no trailing slash)
 */
export function getPublicSiteUrl(): string {
  return process.env.BETTER_AUTH_URL || DEFAULT_PUBLIC_SITE_URL;
}
