import { PostHog } from "posthog-node";
import { POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from "@/lib/config/posthog";
import { log } from "@/lib/utils/log";

/**
 * Server-side PostHog helpers for Cloudflare Workers.
 *
 * Uses flushAt:1 / flushInterval:0 so each capture is sent immediately —
 * required for short-lived isolates where batching would drop events.
 * Analytics must never break product API success paths: capture is best-effort.
 */

/**
 * Creates a PostHog server client, or `null` when no project token is available.
 */
export function getPostHogClient(): PostHog | null {
  if (!POSTHOG_PROJECT_TOKEN) return null;

  return new PostHog(POSTHOG_PROJECT_TOKEN, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Capture a server-side event. Never throws — failures are logged and ignored
 * so analytics outages cannot turn a successful write into a 500.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId,
      event,
      properties,
    });
    await posthog.shutdown();
  } catch (error) {
    log("warn", "posthog capture failed", {
      event,
      distinctId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
