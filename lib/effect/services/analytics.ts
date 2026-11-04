import { Context, Effect, Layer } from "effect";
import { z } from "zod";
import type {
  AnalyticsMetric,
  AnalyticsPageviews,
  AnalyticsStats,
  MetricsOptions,
  PageviewsOptions,
  StatsOptions,
} from "@/lib/analytics/types";
import * as ga4 from "@/lib/ga4/client";
import * as umami from "@/lib/umami/client";
import { classifyUpstreamCause, externalCall } from "../external";
import { HttpUpstreamFailed, type UpstreamDetails, type UpstreamKind } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

const sourceSchema = z.enum(["umami", "ga4"]).default("umami");

function classifyAnalytics(cause: unknown): UpstreamKind {
  if (cause instanceof z.ZodError) return "invalid-response";

  return classifyUpstreamCause(cause);
}

type AnalyticsService = {
  readonly getStats: (opts: StatsOptions) => Effect.Effect<AnalyticsStats, HttpUpstreamFailed>;
  readonly getPageviews: (
    opts: PageviewsOptions,
  ) => Effect.Effect<AnalyticsPageviews, HttpUpstreamFailed>;
  readonly getMetrics: (
    opts: MetricsOptions,
  ) => Effect.Effect<AnalyticsMetric[], HttpUpstreamFailed>;
};

function service(env: CloudflareEnv): AnalyticsService {
  const source = sourceSchema.parse(env.ANALYTICS_SOURCE);
  const client = source === "ga4" ? ga4 : umami;
  const timeoutMs = TIMEOUT_MS[source];
  const fail = (details: UpstreamDetails) => new HttpUpstreamFailed({ ...details, host: source });

  return {
    getStats: (opts) =>
      externalCall({
        operation: `${source}.stats`,
        timeoutMs,
        run: (signal) => client.getStats(env, opts, signal),
        fail,
        classify: classifyAnalytics,
      }),
    getPageviews: (opts) =>
      externalCall({
        operation: `${source}.pageviews`,
        timeoutMs,
        run: (signal) => client.getPageviews(env, opts, signal),
        fail,
        classify: classifyAnalytics,
      }),
    getMetrics: (opts) =>
      externalCall({
        operation: `${source}.metrics`,
        timeoutMs,
        run: (signal) => client.getMetrics(env, opts, signal),
        fail,
        classify: classifyAnalytics,
      }),
  };
}

/** Read-only analytics; adapters validate upstream payloads before exposing neutral results. */
export class Analytics extends Context.Service<Analytics, AnalyticsService>()(
  "clickfolio/Analytics",
) {
  static layer(env: CloudflareEnv): Layer.Layer<Analytics> {
    return Layer.sync(Analytics, () => service(env));
  }

  /** For tests: a fake in place of the HTTP client. */
  static layerFrom(fake: AnalyticsService): Layer.Layer<Analytics> {
    return Layer.succeed(Analytics, fake);
  }
}
