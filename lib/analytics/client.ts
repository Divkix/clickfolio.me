import posthog from "posthog-js/dist/module.no-external";

// SAFETY: module.no-external is an IIFE bundle; its default export carries the
import type { AnalyticsEventMap } from "@/lib/analytics/events";

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

/**
 * Arbitrary value accepted by PostHog's exception capture — forwarded verbatim,
 * never narrowed or decoded here; error-capture paths must not reject inputs.
 */
export type AnalyticsErrorValue = Parameters<typeof posthog.captureException>[0];

export function isAnalyticsInitialized(): boolean {
  return posthog.__loaded === true;
}

export function trackAnalyticsEvent<E extends keyof AnalyticsEventMap>(
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  // SAFETY: payload shape is guaranteed by AnalyticsEventMap; cast bridges the
  posthog.capture(event, properties as AnalyticsProperties);
}

export function identifyAnalyticsUser(
  userId: string,
  traits?: Record<string, string | number | boolean | null>,
): void {
  posthog.identify(userId, traits);
}

export function resetAnalyticsIdentity(): void {
  posthog.reset();
}

export function captureAnalyticsError(
  error: AnalyticsErrorValue,
  properties?: AnalyticsProperties,
): void {
  try {
    posthog.captureException(error, properties);
  } catch {}
}
