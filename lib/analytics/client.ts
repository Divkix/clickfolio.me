// module.no-external is an IIFE bundle; its default export carries the same
// PostHogInterface as "posthog-js" minus external-dependency loaders.
import posthog from "posthog-js/dist/module.no-external";

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
  // wider Properties type posthog-js accepts.
  posthog.capture(event, properties as AnalyticsProperties);
}

export function identifyAnalyticsUser(
  userId: string,
  traits?: Record<string, string | number | boolean | null>,
): void {
  posthog.identify(userId, traits);
}

/** Super properties: attached to every later client event from this browser. */
export function registerAnalyticsProperties(properties: AnalyticsProperties): void {
  posthog.register(properties);
}

/** Person properties written only if unset — first-touch attribution survives identify(). */
export function setAnalyticsPersonPropertiesOnce(properties: AnalyticsProperties): void {
  posthog.setPersonProperties(undefined, properties);
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
