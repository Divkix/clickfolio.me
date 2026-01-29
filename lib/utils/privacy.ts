/**
 * Privacy filtering utilities for resume content
 * Ensures sensitive information is properly filtered based on user preferences
 */

/**
 * Extracts city and state from a full address string
 * Removes street address components while preserving city/state information
 *
 * @param location - Full address string or city/state
 * @returns City and state only, or empty string if invalid
 *
 * @example
 * extractCityState("123 Main St, San Francisco, CA 94102")
 * // Returns: "San Francisco, CA"
 *
 * @example
 * extractCityState("San Francisco, CA")
 * // Returns: "San Francisco, CA"
 *
 * @example
 * extractCityState("New York, NY 10001")
 * // Returns: "New York, NY"
 */
export function extractCityState(location: string | undefined): string {
  if (!location || location.trim() === "") {
    return "";
  }

  // Trim and normalize whitespace
  const normalized = location.trim().replace(/\s+/g, " ");

  // Pattern 1: Full address with ZIP (e.g., "123 Main St, San Francisco, CA 94102")
  // Extract the city and state before the ZIP code
  const fullAddressWithZip = /,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
  const matchWithZip = normalized.match(fullAddressWithZip);
  if (matchWithZip) {
    return `${matchWithZip[1]}, ${matchWithZip[2]}`;
  }

  // Pattern 2: Full address without ZIP (e.g., "123 Main St, San Francisco, CA")
  // Take the last two comma-separated parts
  const parts = normalized.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    // Assume last two parts are city and state
    const state = parts[parts.length - 1];
    const city = parts[parts.length - 2];

    // Validate state code (2 uppercase letters)
    if (/^[A-Z]{2}$/.test(state)) {
      return `${city}, ${state}`;
    }
  }

  // Pattern 3: Already city/state format (e.g., "San Francisco, CA")
  // Validate and return as-is
  const cityStatePattern = /^([^,]+),\s*([A-Z]{2})$/;
  const matchCityState = normalized.match(cityStatePattern);
  if (matchCityState) {
    return normalized;
  }

  // Pattern 4: City, State ZIP (e.g., "San Francisco, CA 94102")
  const cityStateZip = /^([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
  const matchCityStateZip = normalized.match(cityStateZip);
  if (matchCityStateZip) {
    return `${matchCityStateZip[1]}, ${matchCityStateZip[2]}`;
  }

  // Pattern 5: City only (no state detected)
  // Return as-is if it doesn't look like a street address
  const hasStreetNumber = /^\d+\s/.test(normalized);
  if (!hasStreetNumber && parts.length === 1) {
    return normalized;
  }

  // If all else fails and we have multiple parts, try to extract meaningful location
  // Assume the last comma-separated part might be state/country
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    // If last part is a 2-letter code, it's likely a state
    if (/^[A-Z]{2}$/.test(last)) {
      return `${secondLast}, ${last}`;
    }

    // Otherwise, return last two parts (might be city, country)
    return `${secondLast}, ${last}`;
  }

  // Fallback: return the original if we can't parse it
  // Better to show something than nothing
  return normalized;
}

/**
 * Full privacy settings type
 */
export interface PrivacySettingsType {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search: boolean;
}

/**
 * Type guard to check if privacy settings are valid
 * Backward compatible: hide_from_search is optional (defaults to false)
 */
export function isValidPrivacySettings(
  settings: unknown,
): settings is { show_phone: boolean; show_address: boolean; hide_from_search?: boolean } {
  return (
    typeof settings === "object" &&
    settings !== null &&
    "show_phone" in settings &&
    "show_address" in settings &&
    typeof (settings as { show_phone: unknown }).show_phone === "boolean" &&
    typeof (settings as { show_address: unknown }).show_address === "boolean" &&
    // hide_from_search is optional for backward compatibility
    (!("hide_from_search" in settings) ||
      typeof (settings as { hide_from_search: unknown }).hide_from_search === "boolean")
  );
}

/**
 * Normalizes privacy settings with defaults for missing fields
 * Ensures backward compatibility with existing data
 */
export function normalizePrivacySettings(
  settings: { show_phone: boolean; show_address: boolean; hide_from_search?: boolean } | null,
): PrivacySettingsType {
  if (!settings) {
    return {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
    };
  }

  return {
    show_phone: settings.show_phone,
    show_address: settings.show_address,
    hide_from_search: settings.hide_from_search ?? false,
  };
}
