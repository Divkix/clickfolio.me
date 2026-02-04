/**
 * A/B Testing Client Utilities
 *
 * Client-side utilities for reading the A/B test variant.
 * Safe to import in client components.
 */

import { AB_COOKIE_NAME, type ABVariant } from "./constants";

/**
 * Get the A/B test variant on the client side
 *
 * Reads the variant from document.cookie using regex matching.
 * Falls back to "A" if no cookie is found.
 *
 * @example
 * ```tsx
 * // In a Client Component
 * const variant = getVariantClient();
 * ```
 */
export function getVariantClient(): ABVariant {
  if (typeof document === "undefined") {
    // SSR context, return default
    return "A";
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${AB_COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];

  if (value === "A" || value === "B") {
    return value;
  }

  // Fallback to A if cookie is missing or invalid
  return "A";
}
