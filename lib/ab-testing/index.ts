/**
 * A/B Testing Utilities
 *
 * Re-exports constants and client utilities.
 * For server-side variant reading, import from '@/lib/ab-testing/server'.
 */

export { getVariantClient } from "./client";
export { AB_COOKIE_MAX_AGE, AB_COOKIE_NAME, type ABVariant } from "./constants";
