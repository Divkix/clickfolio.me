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
 * @param baseUrl - The base URL of the site (e.g., "https://webresume.now")
 * @param zoneId - Cloudflare zone ID
 * @param apiToken - Cloudflare API token with Cache Purge permissions
 * @returns boolean indicating success (true) or failure (false)
 *
 * @example
 * ```typescript
 * const success = await purgeResumeCache(
 *   "johndoe",
 *   "https://webresume.now",
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

/**
 * Purges multiple resume URLs from Cloudflare edge cache.
 *
 * @param handles - Array of user handles to purge
 * @param baseUrl - The base URL of the site
 * @param zoneId - Cloudflare zone ID
 * @param apiToken - Cloudflare API token with Cache Purge permissions
 * @returns boolean indicating if all purges succeeded
 */
export async function purgeMultipleResumeCaches(
  handles: string[],
  baseUrl: string,
  zoneId: string,
  apiToken: string,
): Promise<boolean> {
  if (!handles.length || !baseUrl || !zoneId || !apiToken) {
    console.error("purgeMultipleResumeCaches: Missing required parameters");
    return false;
  }

  // Normalize base URL (remove trailing slash)
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  // Use @ prefix convention for handle URLs
  const urls = handles.map((handle) => `${normalizedBaseUrl}/@${handle}`);

  // Cloudflare allows up to 30 files per purge request
  const BATCH_SIZE = 30;
  let allSuccess = true;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: batch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare batch cache purge failed: ${response.status}`, errorText);
        allSuccess = false;
        continue;
      }

      const result = (await response.json()) as CloudflarePurgeResponse;

      if (!result.success) {
        console.error("Cloudflare batch cache purge returned error:", result.errors);
        allSuccess = false;
      }
    } catch (error) {
      console.error("Cloudflare batch cache purge exception:", error);
      allSuccess = false;
    }
  }

  return allSuccess;
}
