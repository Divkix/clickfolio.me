import { Context, Effect, Layer } from "effect";
import { externalCall } from "@/lib/effect/external";
import { HttpUpstreamFailed } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { INDEXNOW_ENDPOINT, indexNowRequest } from "@/lib/seo/indexnow";

export interface IndexNowResponse {
  status: number;
  retryAfter: string | null;
}

type IndexNowService = {
  /** One bounded request; the durable outbox owns HTTP refusals, cooldowns and retries. */
  readonly submit: (urls: string[]) => Effect.Effect<IndexNowResponse, HttpUpstreamFailed>;
};

/** Per-invocation HTTP client. No per-isolate/cache state: dedupe lives in Postgres. */
export class IndexNow extends Context.Service<IndexNow, IndexNowService>()("clickfolio/IndexNow") {
  static layer(): Layer.Layer<IndexNow> {
    return Layer.succeed(IndexNow, {
      submit: (urls) =>
        externalCall({
          operation: "indexnow.submit",
          timeoutMs: TIMEOUT_MS.upstream,
          run: async (signal) => {
            const response = await fetch(INDEXNOW_ENDPOINT, { ...indexNowRequest(urls), signal });
            const result = {
              status: response.status,
              retryAfter: response.headers.get("Retry-After"),
            };

            await response.body?.cancel();

            return result;
          },
          fail: (details) => new HttpUpstreamFailed({ ...details, host: "indexnow" }),
        }),
    });
  }
}
