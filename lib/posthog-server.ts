import { PostHog } from "posthog-node";

/**
 * Creates a PostHog server-side client for use in API routes and server actions.
 * Uses flushAt:1 / flushInterval:0 to send events immediately — required for
 * short-lived Cloudflare Workers where batching would silently drop events.
 */
export function getPostHogClient(): PostHog {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}
