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

interface CloudflarePurgeResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result?: {
    id: string;
  };
}

/**
 * Purges the Cloudflare edge cache for a specific resume URL.
 *
 * This function calls the Cloudflare Cache Purge API to immediately remove
 * cached responses from the edge. Use this for privacy-sensitive changes
 * (e.g., hiding phone number, address) where the user expects immediate effect.
 *
 * @param handle - The user's handle (username)
 * @param baseUrl - The base URL of the site (e.g., "https://clickfolio.me")
 * @param zoneId - Cloudflare zone ID
 * @param apiToken - Cloudflare API token with Cache Purge permissions
 * @returns boolean indicating success (true) or failure (false)
 *
 * @example
 * ```typescript
 * const success = await purgeResumeCache(
 *   "johndoe",
 *   "https://clickfolio.me",
 *   env.CF_ZONE_ID,
 *   env.CF_CACHE_PURGE_API_TOKEN
 * );
 * ```
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

  // Normalize base URL (remove trailing slash)
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  // Use @ prefix convention for handle URLs
  const resumeUrl = `${normalizedBaseUrl}/@${handle}`;

  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [resumeUrl],
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

    console.log(`Successfully purged Cloudflare cache for: ${resumeUrl}`);
    return true;
  } catch (error) {
    // Log but don't throw - cache purge is best-effort
    console.error("Cloudflare cache purge exception:", error);
    return false;
  }
}
