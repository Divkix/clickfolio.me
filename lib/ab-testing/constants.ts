/**
 * A/B Testing Constants
 *
 * Shared constants for A/B testing infrastructure.
 * These can be safely imported from any context (server, client, edge).
 */

/**
 * A/B test cookie name
 */
export const AB_COOKIE_NAME = "cf_ab_conversion_v1";

/**
 * A/B test cookie max age in seconds (30 days)
 */
export const AB_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * A/B test variant type
 */
export type ABVariant = "A" | "B";
