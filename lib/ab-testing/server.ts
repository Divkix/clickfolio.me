/**
 * A/B Testing Server Utilities
 *
 * Server-side utilities for reading the A/B test variant.
 * This file uses next/headers and can only be imported in Server Components.
 */

import { cookies } from "next/headers";
import { AB_COOKIE_NAME, type ABVariant } from "./constants";

/**
 * Get the A/B test variant on the server side
 *
 * Reads the variant from the cookie store using next/headers.
 * Falls back to "A" if no cookie is found (should not happen
 * since middleware assigns the cookie on every request).
 *
 * @example
 * ```tsx
 * // In a Server Component or async function
 * const variant = await getVariantServer();
 * ```
 */
export async function getVariantServer(): Promise<ABVariant> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AB_COOKIE_NAME);
  const value = cookie?.value;

  if (value === "A" || value === "B") {
    return value;
  }

  // Fallback to A if cookie is missing or invalid
  return "A";
}
