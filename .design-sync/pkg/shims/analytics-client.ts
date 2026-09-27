// Design-sync shim: analytics are no-ops in design previews (keeps posthog-js out of the bundle).
export const isAnalyticsInitialized = () => false;
export const trackAnalyticsEvent = (..._a: unknown[]) => {};
export const identifyAnalyticsUser = (..._a: unknown[]) => {};
export const registerAnalyticsProperties = (..._a: unknown[]) => {};
export const setAnalyticsPersonPropertiesOnce = (..._a: unknown[]) => {};
export const resetAnalyticsIdentity = () => {};
export const captureAnalyticsError = (..._a: unknown[]) => {};
