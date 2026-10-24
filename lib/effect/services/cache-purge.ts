import { Context, Effect, Layer } from "effect";
import * as z from "zod";
import type { PurgeTags } from "@/lib/cache/edge-purge";
import { externalCall } from "@/lib/effect/external";
import { HttpUpstreamFailed, type UpstreamKind } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";

/** What `ctx.cache.purge()` resolves to; parsed because it crosses an RPC boundary. */
export const purgeResultSchema = z.object({
  success: z.boolean(),
  errors: z
    .array(z.object({ code: z.number().optional(), message: z.string().optional() }))
    .default([]),
});

export type PurgeResult = z.infer<typeof purgeResultSchema>;

/** Fixed label for `HttpUpstreamFailed`: the Workers Cache purge API behind the cached entrypoint. */
const PURGE_HOST = "workers-cache";

const OPERATION = "cache.purge";

type CachePurgeService = {
  /**
   * Purges encoded tags. Fails `unavailable` when the cache is missing, the call throws or times
   * out, or the purge reports `success: false` (rate limits arrive this way, with no code
   * contract), and `invalid-response` when the result is not the documented shape.
   */
  readonly purge: (tags: string[]) => Effect.Effect<void, HttpUpstreamFailed>;
};

function failure(kind: UpstreamKind, message: string): HttpUpstreamFailed {
  return new HttpUpstreamFailed({ operation: OPERATION, kind, message, host: PURGE_HOST });
}

function describeErrors(result: PurgeResult): string {
  return (
    result.errors
      .map(({ code, message }) => [code, message].filter(Boolean).join(": "))
      .join(", ") || "unknown"
  );
}

function interpret(raw: PurgeResult | undefined): Effect.Effect<void, HttpUpstreamFailed> {
  if (raw === undefined) {
    return Effect.fail(
      failure("unavailable", "Workers Cache unavailable on the cached entrypoint"),
    );
  }

  const parsed = purgeResultSchema.safeParse(raw);

  if (!parsed.success) {
    return Effect.fail(failure("invalid-response", "unrecognized purge result"));
  }

  if (!parsed.data.success) {
    return Effect.fail(failure("unavailable", describeErrors(parsed.data)));
  }

  return Effect.void;
}

function service(rpc: PurgeTags): CachePurgeService {
  return {
    purge: (tags) =>
      externalCall({
        operation: OPERATION,
        timeoutMs: TIMEOUT_MS.upstream,
        run: () => rpc(tags),
        fail: (details) => new HttpUpstreamFailed({ ...details, host: PURGE_HOST }),
      }).pipe(Effect.flatMap(interpret)),
  };
}

/** Workers Cache purge through the `VinextCachedResponse` entrypoint, the only one that can reach the cache. */
export class CachePurge extends Context.Service<CachePurge, CachePurgeService>()(
  "clickfolio/CachePurge",
) {
  static layer(ctx: ExecutionContext): Layer.Layer<CachePurge> {
    return Layer.sync(CachePurge, () =>
      service(async (tags) => {
        const cached = ctx.exports.VinextCachedResponse({ props: {} });

        // RPC types turn purge's `Promise<unknown>` into `never`; the call still returns a
        // promise of ctx.cache.purge()'s result (undefined without a cache), validated above.
        return Promise.resolve(cached.purge({ tags }));
      }),
    );
  }

  /** For tests: any function standing in for the RPC. */
  static layerFrom(rpc: PurgeTags): Layer.Layer<CachePurge> {
    return Layer.succeed(CachePurge, service(rpc));
  }
}
