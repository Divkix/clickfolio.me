import { waitUntil } from "cloudflare:workers";
import { siteConfig } from "@/lib/config/site";
import { profileUrls, submitToIndexNow } from "@/lib/seo/indexnow";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";

/** A URL submitted within this window is skipped: search engines coalesce pings anyway. */
const DEBOUNCE_SECONDS = 10 * 60;

/** Only the production Worker pings; local dev and `wrangler dev` override APP_URL. */
function isProductionSite(): boolean {
  return process.env.APP_URL === siteConfig.url;
}

function debounceKey(url: string): string {
  return `${siteConfig.url}/__indexnow-debounce/${encodeURIComponent(url)}`;
}

async function openDebounceCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;

  return caches.open("indexnow-debounce");
}

/**
 * Drops URLs pinged within DEBOUNCE_SECONDS. Marking happens after a successful submission, so
 * a rejected ping is retried on the next change instead of being suppressed. Uses the Workers
 * Cache API, so the debounce is per-colo and best-effort; without a cache (tests, Node) nothing
 * is skipped.
 */
async function takeUndebounced(urls: string[]): Promise<string[]> {
  const cache = await openDebounceCache();

  if (!cache) return urls;

  const fresh: string[] = [];

  for (const url of new Set(urls)) {
    if (await cache.match(debounceKey(url))) continue;

    fresh.push(url);
  }

  return fresh;
}

async function markDebounced(urls: string[]): Promise<void> {
  const cache = await openDebounceCache();

  if (!cache) return;

  await Promise.all(
    urls.map((url) =>
      cache.put(
        debounceKey(url),
        new Response("1", { headers: { "Cache-Control": `max-age=${DEBOUNCE_SECONDS}` } }),
      ),
    ),
  );
}

async function submitProfiles(urls: string[]): Promise<void> {
  try {
    const fresh = await takeUndebounced(urls);

    if (fresh.length === 0) return;

    const result = await submitToIndexNow(fresh);
    const accepted = result.submitted === fresh.length;

    if (accepted) await markDebounced(fresh);

    log(accepted ? "info" : "warn", "indexnow submitted", {
      urls: fresh,
      statuses: result.statuses,
    });
  } catch (error) {
    log("warn", "indexnow submission failed", { ...errorFields(error) });
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
    log("warn", "indexnow waitUntil registration failed", { ...errorFields(error) });
  }
}
