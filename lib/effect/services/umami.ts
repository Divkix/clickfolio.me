import { Context, Effect, Layer } from "effect";
import { z } from "zod";
import {
  getMetrics,
  getPageviews,
  getStats,
  type MetricsOptions,
  type PageviewsOptions,
  type StatsOptions,
  type UmamiMetric,
  type UmamiPageviews,
  type UmamiStats,
} from "@/lib/umami/client";
import { classifyUpstreamCause, externalCall } from "../external";
import { HttpUpstreamFailed, type UpstreamDetails, type UpstreamKind } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

// A response that parses as JSON but not as the expected shape is the server's fault, not ours.
function classifyUmami(cause: unknown): UpstreamKind {
  if (cause instanceof z.ZodError) return "invalid-response";

  return classifyUpstreamCause(cause);
}

function umamiFailure(details: UpstreamDetails): HttpUpstreamFailed {
  return new HttpUpstreamFailed({ ...details, host: "umami" });
}

type UmamiService = {
  readonly getStats: (opts: StatsOptions) => Effect.Effect<UmamiStats, HttpUpstreamFailed>;
  readonly getPageviews: (
    opts: PageviewsOptions,
  ) => Effect.Effect<UmamiPageviews, HttpUpstreamFailed>;
  readonly getMetrics: (opts: MetricsOptions) => Effect.Effect<UmamiMetric[], HttpUpstreamFailed>;
};

function service(env: CloudflareEnv): UmamiService {
  return {
    getStats: (opts) =>
      externalCall({
        operation: "umami.stats",
        timeoutMs: TIMEOUT_MS.umami,
        run: (signal) => getStats(env, opts, signal),
        fail: umamiFailure,
        classify: classifyUmami,
      }),
    getPageviews: (opts) =>
      externalCall({
        operation: "umami.pageviews",
        timeoutMs: TIMEOUT_MS.umami,
        run: (signal) => getPageviews(env, opts, signal),
        fail: umamiFailure,
        classify: classifyUmami,
      }),
    getMetrics: (opts) =>
      externalCall({
        operation: "umami.metrics",
        timeoutMs: TIMEOUT_MS.umami,
        run: (signal) => getMetrics(env, opts, signal),
        fail: umamiFailure,
        classify: classifyUmami,
      }),
  };
}

/**
 * Read-only Umami analytics. Reads are idempotent, so a caller may recover from a timeout.
 * Responses are validated against Zod schemas in `lib/umami/client.ts`.
 */
export class Umami extends Context.Service<Umami, UmamiService>()("clickfolio/Umami") {
  static layer(env: CloudflareEnv): Layer.Layer<Umami> {
    return Layer.sync(Umami, () => service(env));
  }

  /** For tests: a fake in place of the HTTP client. */
  static layerFrom(fake: UmamiService): Layer.Layer<Umami> {
    return Layer.succeed(Umami, fake);
  }
}
