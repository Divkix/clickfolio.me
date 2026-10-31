import { siteConfig } from "@/lib/config/site";

/**
 * IndexNow request helpers shared by the durable Worker sender and the deploy script.
 * The key is public by design: search engines verify it by fetching `public/<key>.txt`.
 */
export const INDEXNOW_KEY = "0a934a6df632d13f7be3cd7440f18551";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Deduplicated URLs on the site's own host — the endpoint rejects foreign hosts with 422. */
export function filterSiteUrls(
  urls: readonly string[],
  siteUrl: string = siteConfig.url,
): string[] {
  const host = new URL(siteUrl).host;
  const unique = new Set<string>();

  for (const url of urls) {
    try {
      if (new URL(url).host === host) unique.add(url);
    } catch {
      // Not a URL; skip it.
    }
  }

  return [...unique];
}

/** The endpoint answers 200 or 202 when it takes the URLs; anything else is a rejection or a limit. */
export function isIndexNowAccepted(status: number): boolean {
  return status === 200 || status === 202;
}

/**
 * Retry-After supports delay-seconds and HTTP dates (RFC 9110 §10.2.3). A missing or invalid
 * value leaves the durable sender's exponential fallback in charge.
 */
export function indexNowRetryAt(value: string | null, now: number): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const timestamp = /^\d+$/.test(trimmed) ? now + Number(trimmed) * 1_000 : Date.parse(trimmed);

  return Number.isFinite(timestamp) && timestamp >= now && timestamp <= 8.64e15
    ? timestamp
    : undefined;
}

/** The POST for one batch of site URLs, ready for `fetch` (add the caller's `signal`). */
export function indexNowRequest(
  batch: readonly string[],
  siteUrl: string = siteConfig.url,
): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(siteUrl).host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    }),
  };
}

/** Canonical portfolio URLs for the given handles (nulls skipped). */
export function profileUrls(handles: ReadonlyArray<string | null | undefined>): string[] {
  return handles.flatMap((handle) => (handle ? [`${siteConfig.url}/@${handle}`] : []));
}

/** `<loc>` values from a sitemap or sitemap index document. */
export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].flatMap((match) =>
    match[1] ? [match[1].replaceAll("&amp;", "&")] : [],
  );
}

/** Portfolio URLs (`/@handle`) are pinged at runtime on publish; deploys only ping static pages. */
export function isStaticSiteUrl(url: string): boolean {
  try {
    return !new URL(url).pathname.startsWith("/@");
  } catch {
    return false;
  }
}
