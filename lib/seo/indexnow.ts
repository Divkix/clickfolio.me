import { siteConfig } from "@/lib/config/site";

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

/**
 * POSTs `urls` to IndexNow in protocol-sized batches. Never throws: IndexNow is a hint, and a
 * failure must not fail a deploy or a user request.
 */
export async function submitToIndexNow(
  urls: readonly string[],
  { siteUrl = siteConfig.url, fetchImpl = fetch }: SubmitOptions = {},
): Promise<IndexNowResult> {
  const urlList = filterSiteUrls(urls, siteUrl);
  const result: IndexNowResult = { submitted: 0, statuses: [] };
  const host = new URL(siteUrl).host;

  for (let start = 0; start < urlList.length; start += MAX_URLS_PER_REQUEST) {
    const batch = urlList.slice(start, start + MAX_URLS_PER_REQUEST);

    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key: INDEXNOW_KEY,
          keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
        }),
      });

      result.statuses.push(response.status);

      if (response.status === 200 || response.status === 202) result.submitted += batch.length;
    } catch {
      result.statuses.push(0);
    }
  }

  return result;
}

/** Canonical portfolio URLs for the given handles (nulls skipped). */
export function profileUrls(
  handles: ReadonlyArray<string | null | undefined>,
  siteUrl: string = siteConfig.url,
): string[] {
  return handles.flatMap((handle) => (handle ? [`${siteUrl}/@${handle}`] : []));
}
