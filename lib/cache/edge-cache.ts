/**
 * Workers Cache for public pages (https://developers.cloudflare.com/workers/cache/).
 *
 * The worker sends every GET/HEAD page read through the `CachedPages` entrypoint, the only one
 * with `cache.enabled` (wrangler.jsonc `exports`). A route opts in by returning
 * `edgeCacheHeaders()` from its `headers()`; `edgeResponse` stamps everything else `no-store`, so
 * nothing reaches the shared cache by accident. Purges are entrypoint-scoped and go through
 * `CachedPages.purge`.
 */

/** The edge's policy; Workers Cache prefers it over `Cache-Control`, which stays for browsers. */
export const EDGE_CACHE_CONTROL = "Cloudflare-CDN-Cache-Control";

export const CACHE_TAG = "Cache-Tag";

/** Browsers always revalidate: only the edge holds a page, so a purge reaches every visitor. */
const BROWSER_CACHE_CONTROL = "private, max-age=0, must-revalidate";

/** What a page that set no policy of its own sends (Next's header for dynamic pages). */
const NEVER_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

/** Serve stale while the next render runs; a purge or the next miss replaces the entry. */
const STALE_WHILE_REVALIDATE_SECONDS = 31_536_000;

/** `edge-` + 32 hex: what `encodeCacheTag` emits and the purge queue accepts. */
export const ENCODED_CACHE_TAG = /^edge-[0-9a-f]{32}$/;

const FNV_OFFSET = 0xcbf29ce484222325n;

const FNV_PRIME = 0x100000001b3n;

const UINT64 = 0xffffffffffffffffn;

function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;

  for (const byte of new TextEncoder().encode(input)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & UINT64;
  }

  return hash.toString(16).padStart(16, "0");
}

/**
 * Fixed-size digest of a logical tag, so no handle reaches `Cache-Tag`, the purge queue or logs.
 * Two salted 64-bit hashes keep collisions out of reach for this tag count.
 */
export function encodeCacheTag(tag: string): string {
  return `edge-${fnv1a64(`0:${tag}`)}${fnv1a64(`1:${tag}`)}`;
}

/** Every `/examples/<slug>` page lists directory profiles. */
const EXAMPLES_TAG = "examples";

export function profileCacheTag(handle: string): string {
  return encodeCacheTag(`profile:${handle}`);
}

export const EXAMPLES_CACHE_TAG = encodeCacheTag(EXAMPLES_TAG);

/**
 * The encoded tags a profile change makes stale: each profile page and the example galleries.
 * `/explore` is absent: it reads its query string and is never edge-cached.
 */
export function publicProfileTags(handles: ReadonlyArray<string | null | undefined>): string[] {
  const tags = [EXAMPLES_CACHE_TAG];

  for (const handle of handles) {
    if (handle) tags.push(profileCacheTag(handle));
  }

  return tags;
}

/** A route's `headers()` for a page the edge may share for `maxAgeSeconds`. */
export function edgeCacheHeaders(maxAgeSeconds: number, tags: readonly string[] = []) {
  const headers = {
    "Cache-Control": BROWSER_CACHE_CONTROL,
    [EDGE_CACHE_CONTROL]: `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
  };

  if (tags.length === 0) return headers;

  return { ...headers, [CACHE_TAG]: tags.join(",") };
}

/**
 * What `CachedPages` hands to Workers Cache: the route's own policy when it opted in, the render
 * did not fail (a 5xx must never be shared) and the request was `shareable`; `no-store`
 * otherwise. A page that set no `Cache-Control` (signed-in pages) tells browsers not to store it.
 */
export function edgeResponse(response: Response, shareable: boolean): Response {
  if (shareable && response.status < 500 && response.headers.has(EDGE_CACHE_CONTROL)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set(EDGE_CACHE_CONTROL, "no-store");
  headers.delete(CACHE_TAG);

  if (!headers.has("Cache-Control")) headers.set("Cache-Control", NEVER_CACHE_CONTROL);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Drops the edge-only headers before a response reaches the client. */
export function stripEdgeHeaders(headers: Headers): void {
  headers.delete(EDGE_CACHE_CONTROL);
  headers.delete(CACHE_TAG);
}
