import { Context, Data, Effect, Layer } from "effect";
import { siteConfig } from "@/lib/config/site";
import { classifyUpstreamCause, externalCall } from "@/lib/effect/external";
import { HttpUpstreamFailed, type UpstreamDetails } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { INDEXNOW_ENDPOINT, indexNowRequest, isIndexNowAccepted } from "@/lib/seo/indexnow";

/** A URL submitted within this window is skipped: search engines coalesce pings anyway. */
const DEBOUNCE_SECONDS = 10 * 60;

/** Fixed label for `HttpUpstreamFailed`. */
const INDEXNOW_HOST = "indexnow";

/**
 * The per-colo debounce cache failed. Best-effort by design: the caller logs it and carries on,
 * at worst pinging a URL twice.
 */
export class IndexNowDebounceFailed extends Data.TaggedError(
  "IndexNowDebounceFailed",
)<UpstreamDetails> {}

type IndexNowService = {
  /**
   * POSTs one batch of site URLs. Fails `unavailable` on a limit or a 5xx and `rejected` on any
   * other refusal. Never retried here: a later change to the same profile pings again.
   */
  readonly submit: (urls: string[]) => Effect.Effect<void, HttpUpstreamFailed>;
  /** The URLs not pinged within the debounce window. Without a cache nothing is skipped. */
  readonly undebounced: (urls: string[]) => Effect.Effect<string[], IndexNowDebounceFailed>;
  /** Marks URLs as just pinged; call only after an accepted submission. */
  readonly markDebounced: (urls: string[]) => Effect.Effect<void, IndexNowDebounceFailed>;
};

function debounceKey(url: string): string {
  return `${siteConfig.url}/__indexnow-debounce/${encodeURIComponent(url)}`;
}

function debounceFailure(details: UpstreamDetails): IndexNowDebounceFailed {
  return new IndexNowDebounceFailed(details);
}

async function openDebounceCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;

  return caches.open("indexnow-debounce");
}

async function filterUndebounced(urls: string[]): Promise<string[]> {
  const cache = await openDebounceCache();

  if (!cache) return urls;

  const fresh: string[] = [];

  for (const url of new Set(urls)) {
    if (await cache.match(debounceKey(url))) continue;

    fresh.push(url);
  }

  return fresh;
}

async function putDebounced(urls: string[]): Promise<void> {
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

function service(): IndexNowService {
  return {
    submit: (urls) =>
      externalCall({
        operation: "indexnow.submit",
        timeoutMs: TIMEOUT_MS.upstream,
        run: async (signal) => {
          const response = await fetch(INDEXNOW_ENDPOINT, { ...indexNowRequest(urls), signal });

          // Only the status matters; release the connection without reading the body.
          await response.body?.cancel();

          return response.status;
        },
        fail: (details) => new HttpUpstreamFailed({ ...details, host: INDEXNOW_HOST }),
      }).pipe(
        Effect.flatMap((status) => {
          if (isIndexNowAccepted(status)) return Effect.void;

          return Effect.fail(
            new HttpUpstreamFailed({
              operation: "indexnow.submit",
              kind: classifyUpstreamCause({ status }),
              message: `IndexNow responded ${status}`,
              host: INDEXNOW_HOST,
            }),
          );
        }),
      ),
    undebounced: (urls) =>
      externalCall({
        operation: "indexnow.debounce.read",
        timeoutMs: TIMEOUT_MS.upstream,
        run: () => filterUndebounced(urls),
        fail: debounceFailure,
        span: false,
      }),
    markDebounced: (urls) =>
      externalCall({
        operation: "indexnow.debounce.write",
        timeoutMs: TIMEOUT_MS.upstream,
        run: () => putDebounced(urls),
        fail: debounceFailure,
        span: false,
      }),
  };
}

/** IndexNow pings plus the Workers Cache debounce, built per invocation from the global `fetch` and `caches`. */
export class IndexNow extends Context.Service<IndexNow, IndexNowService>()("clickfolio/IndexNow") {
  static layer(): Layer.Layer<IndexNow> {
    return Layer.sync(IndexNow, service);
  }
}
