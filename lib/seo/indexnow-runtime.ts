import { waitUntil } from "cloudflare:workers";
import { siteConfig } from "@/lib/config/site";
import { profileUrls, submitToIndexNow } from "@/lib/seo/indexnow";
import { log } from "@/lib/utils/log";

/** A URL submitted within this window is skipped: search engines coalesce pings anyway. */
const DEBOUNCE_SECONDS = 10 * 60;

/** Only the production Worker pings; local dev and `wrangler dev` override APP_URL. */
function isProductionSite(): boolean {
  return process.env.APP_URL === siteConfig.url;
}

function debounceKey(url: string): string {
  return `${siteConfig.url}/__indexnow-debounce/${encodeURIComponent(url)}`;
}

/**
 * Drops URLs pinged within DEBOUNCE_SECONDS and marks the rest. Uses the Workers Cache API, so
 * the debounce is per-colo and best-effort; without a cache (tests, Node) nothing is skipped.
 */
async function takeUndebounced(urls: string[]): Promise<string[]> {
  if (typeof caches === "undefined") return urls;

  const cache = await caches.open("indexnow-debounce");
  const fresh: string[] = [];

  for (const url of urls) {
    const key = debounceKey(url);

    if (await cache.match(key)) continue;

    fresh.push(url);
    await cache.put(
      key,
      new Response("1", { headers: { "Cache-Control": `max-age=${DEBOUNCE_SECONDS}` } }),
    );
  }

  return fresh;
}

async function submitProfiles(urls: string[]): Promise<void> {
  try {
    const fresh = await takeUndebounced(urls);

    if (fresh.length === 0) return;

    const result = await submitToIndexNow(fresh);

    log(result.submitted === fresh.length ? "info" : "warn", "indexnow submitted", {
      urls: fresh,
      statuses: result.statuses,
    });
  } catch (error) {
    log("warn", "indexnow submission failed", { error: String(error) });
  }
}

/**
 * Pings IndexNow for portfolios whose public state changed (published, handle changed, privacy
 * changed, deleted). Runs after the response via waitUntil; never throws.
 */
export function notifyIndexNowForProfiles(handles: ReadonlyArray<string | null | undefined>): void {
  if (!isProductionSite()) return;

  const urls = profileUrls(handles);

  if (urls.length === 0) return;

  try {
    waitUntil(submitProfiles(urls));
  } catch (error) {
    log("warn", "indexnow waitUntil registration failed", { error: String(error) });
  }
}
