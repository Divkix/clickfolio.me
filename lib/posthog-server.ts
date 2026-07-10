import { PostHog } from "posthog-node";
import { log } from "@/lib/utils/log";

/**
 * Server-side PostHog helpers for Cloudflare Workers.
 *
 * Uses flushAt:1 / flushInterval:0 so each capture is sent immediately —
 * required for short-lived isolates where batching would drop events.
 * Analytics must never break product API success paths: capture is best-effort.
 */

function getPostHogToken(): string | undefined {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || token.trim() === "") return undefined;
  return token;
}

/**
 * Creates a PostHog server client, or `null` when the project token is unset
 * (local/dev without analytics configured).
 */
export function getPostHogClient(): PostHog | null {
  const token = getPostHogToken();
  if (!token) return null;

  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
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
