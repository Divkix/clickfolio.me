import { waitUntil } from "cloudflare:workers";
import { PostHog } from "posthog-node";

import { POSTHOG_API_HOST, POSTHOG_PROJECT_TOKEN } from "@/lib/analytics/config";
import type { AnalyticsEventMap } from "@/lib/analytics/events";
import type { AnalyticsProperties } from "@/lib/analytics/client";
import { log } from "@/lib/utils/log";

const SHUTDOWN_TIMEOUT_MS = 1000;

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
