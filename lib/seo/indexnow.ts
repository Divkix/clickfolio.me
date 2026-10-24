import { siteConfig } from "@/lib/config/site";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { errorFields } from "@/lib/utils/error-fields";

/**
 * IndexNow client shared by the Worker (portfolio events) and `scripts/submit-indexnow.ts`
 * (post-deploy static pages). The key is public by design: search engines verify it by fetching
 * `public/<key>.txt` from the site.
 */
export const INDEXNOW_KEY = "0a934a6df632d13f7be3cd7440f18551";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Protocol cap per POST. */
const MAX_URLS_PER_REQUEST = 10_000;

export interface IndexNowResult {
  /** URLs accepted by the endpoint (200/202). */
  submitted: number;
  /** HTTP status per batch; 0 when the request threw. */
  statuses: number[];
  /** `name: message` of each batch whose request threw (scrubbed), for the script to print. */
  errors: string[];
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface SubmitOptions {
  siteUrl?: string;
  fetchImpl?: FetchLike;
}

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

/**
 * POSTs `urls` to IndexNow in protocol-sized batches, each limited to the upstream timeout.
 * Never throws: IndexNow is a hint, and a failure must not fail a deploy. This is the Node
 * script's path (`scripts/submit-indexnow.ts`); the Worker goes through the `IndexNow` service.
 */
export async function submitToIndexNow(
  urls: readonly string[],
  { siteUrl = siteConfig.url, fetchImpl = fetch }: SubmitOptions = {},
): Promise<IndexNowResult> {
  const urlList = filterSiteUrls(urls, siteUrl);
  const result: IndexNowResult = { submitted: 0, statuses: [], errors: [] };

  for (let start = 0; start < urlList.length; start += MAX_URLS_PER_REQUEST) {
    const batch = urlList.slice(start, start + MAX_URLS_PER_REQUEST);

    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        ...indexNowRequest(batch, siteUrl),
        signal: AbortSignal.timeout(TIMEOUT_MS.upstream),
      });

      result.statuses.push(response.status);

      if (isIndexNowAccepted(response.status)) result.submitted += batch.length;
    } catch (error) {
      const { "error.name": name, "error.message": message } = errorFields(error);

      result.statuses.push(0);
      result.errors.push(`${name}: ${message}`);
    }
  }

  return result;
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
