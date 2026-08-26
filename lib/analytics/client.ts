import posthog from "posthog-js/dist/module.no-external";

// SAFETY: module.no-external is an IIFE bundle; its default export carries the
// same PostHogInterface as "posthog-js" minus external-dependency loaders.
import type { AnalyticsEventMap } from "@/lib/analytics/events";

/**
 * Browser analytics boundary.
 *
 * Every product surface reports through these functions instead of importing
 * `posthog-js` directly, so event names stay typed against AnalyticsEventMap
 * and initialization stays owned by the root instrumentation-client entry.
 */

/** Whitelisted primitive property values for product analytics payloads. */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

/** True once posthog-js init() completed (no-op guard for identify/track). */
export function isAnalyticsInitialized(): boolean {
  return posthog.__loaded === true;
}

/** Capture a typed product event. Events without properties pass `{}`. */
export function trackAnalyticsEvent<E extends keyof AnalyticsEventMap>(
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  // SAFETY: payload shape is guaranteed by AnalyticsEventMap; cast bridges the
  // wider Properties type posthog-js accepts.
  posthog.capture(event, properties as AnalyticsProperties);
}

/**
 * Bind subsequent events to a stable user id. Traits are profile fields
 * (email/name) — never capture PII via trackAnalyticsEvent.
 */
export function identifyAnalyticsUser(
  userId: string,
  traits?: Record<string, string | number | boolean | null>,
): void {
  posthog.identify(userId, traits);
}

/** Forget the current identity (logout / signed-out browsing). */
export function resetAnalyticsIdentity(): void {
  posthog.reset();
}

/** Report an unhandled error to PostHog Error Tracking. Never throws. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Error boundaries can throw any JavaScript value.
export function captureAnalyticsError(error: unknown, properties?: AnalyticsProperties): void {
  try {
    posthog.captureException(error, properties);
  } catch {
    // Error reporting must never become the error that breaks recovery UI.
  }
}
