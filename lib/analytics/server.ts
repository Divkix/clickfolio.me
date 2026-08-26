import { waitUntil } from "cloudflare:workers";
import { PostHog } from "posthog-node";

import { POSTHOG_API_HOST, POSTHOG_PROJECT_TOKEN } from "@/lib/analytics/config";
import type { AnalyticsEventMap } from "@/lib/analytics/events";
// SAFETY: type-only import — erased at build, never pulls posthog-js into the
// server bundle.
import type { AnalyticsProperties } from "@/lib/analytics/client";
import { log } from "@/lib/utils/log";
/**
 * Server-side PostHog helpers for Cloudflare Workers.
 *
 * Every send creates a FRESH client (no isolate-global singleton) with
 * flushAt:1 / flushInterval:0 so the event is sent immediately — required for
 * short-lived isolates where batching would drop events. Event sends are
 * registered with waitUntil so they outlive the response without blocking it;
 * exception captures return their promise so instrumentation hooks can retain
 * it instead. Analytics must never break a product request: failures are
 * logged and swallowed.
 */

const SHUTDOWN_TIMEOUT_MS = 1000;

/**
 * Creates a fresh one-shot PostHog client, or `null` when no token exists.
 * Retries are disabled: a failed analytics send must not stall request
 * teardown waiting on a network path that is already known to be flaky.
 */
function createPostHogClient(): PostHog | null {
  if (!POSTHOG_PROJECT_TOKEN) return null;

  return new PostHog(POSTHOG_PROJECT_TOKEN, {
    host: POSTHOG_API_HOST,
    flushAt: 1,
    flushInterval: 0,
    fetchRetryCount: 0,
    requestTimeout: SHUTDOWN_TIMEOUT_MS,
  });
}

function logFailure(stage: string, error: Error | string): void {
  log("warn", `analytics ${stage} failed`, {
    error: error instanceof Error ? error.message : error,
  });
}

/**
 * Capture a server-side product event. Fire-and-forget: returns immediately,
 * registers the send + terminal shutdown with the request's waitUntil, and
 * callers MUST NOT await it.
 */
export function captureServerEvent<E extends keyof AnalyticsEventMap>(
  distinctId: string,
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  const posthog = createPostHogClient();
  if (!posthog) return;

  const send = (async () => {
    try {
      await posthog.captureImmediate({ distinctId, event, properties });
    } catch (error) {
      logFailure("capture", error instanceof Error ? error : String(error));
    } finally {
      try {
        await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
      } catch (error) {
        logFailure("shutdown", error instanceof Error ? error : String(error));
      }
    }
  })();

  try {
    waitUntil(send);
  } catch (error) {
    logFailure("waitUntil registration", error instanceof Error ? error : String(error));
  }
}

/**
 * Capture an unhandled server exception to Error Tracking. Returns the send
 * promise (vinext retains it via the request execution context), so callers
 * may return/await it. Metadata goes in the third argument — never the
 * optional distinct-id slot.
 */
// Error instrumentation receives arbitrary thrown JavaScript values by contract.
// oxlint-disable anti-slop/no-unknown-parameters
export async function captureServerException(
  error: unknown,
  properties?: AnalyticsProperties,
): Promise<void> {
  const posthog = createPostHogClient();
  if (!posthog) return;

  try {
    await posthog.captureExceptionImmediate(error, undefined, properties);
  } catch (captureError) {
    logFailure(
      "exception capture",
      captureError instanceof Error ? captureError : String(captureError),
    );
  } finally {
    try {
      await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
    } catch (shutdownError) {
      logFailure(
        "shutdown",
        shutdownError instanceof Error ? shutdownError : String(shutdownError),
      );
    }
  }
}
// oxlint-enable anti-slop/no-unknown-parameters
