/**
 * Cloudflare Cache Purge Utility
 *
 * Provides functions to purge Cloudflare edge cache for immediate cache removal.
 * Used for privacy-sensitive changes where stale-while-revalidate is not acceptable.
 *
 * Requires:
 * - CF_ZONE_ID: Cloudflare zone ID for the domain
 * - CF_CACHE_PURGE_API_TOKEN: API token with Cache Purge permissions
 */

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const PUBLIC_CACHE_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/explore",
  "/robots.txt",
  "/sitemap.xml",
  "/api/og/home",
] as const;

interface CloudflarePurgeResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result?: {
    id: string;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function purgeLogTarget(urls: string[]): string {
  return urls.length === 1 ? urls[0] : `${urls.length} URLs`;
}

export function buildResumeCacheUrls(handle: string, baseUrl: string): string[] {
  if (!handle || !baseUrl) return [];

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const encodedHandle = encodeURIComponent(handle);

  return [`${normalizedBaseUrl}/@${handle}`, `${normalizedBaseUrl}/api/og/${encodedHandle}`];
}

export function buildPublicPageCacheUrls(baseUrl: string): string[] {
  if (!baseUrl) return [];

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return PUBLIC_CACHE_PATHS.map((path) =>
    path === "/" ? normalizedBaseUrl : `${normalizedBaseUrl}${path}`,
  );
}

export async function purgeCloudflareCacheUrls(
  urls: string[],
  zoneId: string,
  apiToken: string,
): Promise<boolean> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  if (uniqueUrls.length === 0 || !zoneId || !apiToken) {
    console.error("purgeResumeCache: Missing required parameters");
    return false;
  }

  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: uniqueUrls,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Cloudflare cache purge failed: ${response.status} ${response.statusText}`,
        errorText,
      );
      return false;
    }

    const result = (await response.json()) as CloudflarePurgeResponse;

    if (!result.success) {
      console.error("Cloudflare cache purge returned error:", result.errors);
      return false;
    }

    console.log(`Successfully purged Cloudflare cache for: ${purgeLogTarget(uniqueUrls)}`);
    return true;
  } catch (error) {
    // Log but don't throw - cache purge is best-effort
    console.error("Cloudflare cache purge exception:", error);
    return false;
  }
}

/**
 * Purges the Cloudflare edge cache for public resume assets.
 *
 * This removes both the HTML profile page and its OG image so social previews
 * stay in sync with handle/content/theme updates.
 */
export async function purgeResumeCache(
  handle: string,
  baseUrl: string,
  zoneId: string,
  apiToken: string,
): Promise<boolean> {
  if (!handle || !baseUrl || !zoneId || !apiToken) {
    console.error("purgeResumeCache: Missing required parameters");
    return false;
  }

  return purgeCloudflareCacheUrls(buildResumeCacheUrls(handle, baseUrl), zoneId, apiToken);
}

/**
 * Purges cache for code-driven public pages after deploy.
 */
export async function purgePublicPageCache(
  baseUrl: string,
  zoneId: string,
  apiToken: string,
): Promise<boolean> {
  if (!baseUrl || !zoneId || !apiToken) {
    console.error("purgePublicPageCache: Missing required parameters");
    return false;
  }

  return purgeCloudflareCacheUrls(buildPublicPageCacheUrls(baseUrl), zoneId, apiToken);
}
