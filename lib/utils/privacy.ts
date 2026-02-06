/**
 * Privacy filtering utilities for resume content
 * Ensures sensitive information is properly filtered based on user preferences
 */

// Pre-compiled regex patterns for extractCityState (avoid per-call compilation overhead)
const FULL_ADDRESS_WITH_ZIP = /,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
const STATE_CODE = /^[A-Z]{2}$/;
const CITY_STATE_PATTERN = /^([^,]+),\s*([A-Z]{2})$/;
const CITY_STATE_ZIP = /^([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
const STREET_NUMBER = /^\d+\s/;

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
  const matchWithZip = normalized.match(FULL_ADDRESS_WITH_ZIP);
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
    if (STATE_CODE.test(state)) {
      return `${city}, ${state}`;
    }
  }

  // Pattern 3: Already city/state format (e.g., "San Francisco, CA")
  // Validate and return as-is
  const matchCityState = normalized.match(CITY_STATE_PATTERN);
  if (matchCityState) {
    return normalized;
  }

  // Pattern 4: City, State ZIP (e.g., "San Francisco, CA 94102")
  const matchCityStateZip = normalized.match(CITY_STATE_ZIP);
  if (matchCityStateZip) {
    return `${matchCityStateZip[1]}, ${matchCityStateZip[2]}`;
  }

  // Pattern 5: City only (no state detected)
  // Return as-is if it doesn't look like a street address
  const hasStreetNumber = STREET_NUMBER.test(normalized);
  if (!hasStreetNumber && parts.length === 1) {
    return normalized;
  }

  // If all else fails and we have multiple parts, try to extract meaningful location
  // Assume the last comma-separated part might be state/country
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    // If last part is a 2-letter code, it's likely a state
    if (STATE_CODE.test(last)) {
      return `${secondLast}, ${last}`;
    }

    // Otherwise, return last two parts (might be city, country)
    return `${secondLast}, ${last}`;
  }

  // Fallback: return the original if we can't parse it
  // Better to show something than nothing
  return normalized;
}

import type { PrivacySettings } from "@/lib/schemas/profile";

export type { PrivacySettings };

/**
 * Type guard to check if privacy settings are valid
 * Backward compatible: hide_from_search and show_in_directory are optional (defaults to false)
 */
export function isValidPrivacySettings(settings: unknown): settings is {
  show_phone: boolean;
  show_address: boolean;
  hide_from_search?: boolean;
  show_in_directory?: boolean;
} {
  return (
    typeof settings === "object" &&
    settings !== null &&
    "show_phone" in settings &&
    "show_address" in settings &&
    typeof (settings as { show_phone: unknown }).show_phone === "boolean" &&
    typeof (settings as { show_address: unknown }).show_address === "boolean" &&
    // hide_from_search is optional for backward compatibility
    (!("hide_from_search" in settings) ||
      typeof (settings as { hide_from_search: unknown }).hide_from_search === "boolean") &&
    // show_in_directory is optional for backward compatibility
    (!("show_in_directory" in settings) ||
      typeof (settings as { show_in_directory: unknown }).show_in_directory === "boolean")
  );
}

/**
 * Normalizes privacy settings with defaults for missing fields
 * Ensures backward compatibility with existing data
 */
export function normalizePrivacySettings(
  settings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search?: boolean;
    show_in_directory?: boolean;
  } | null,
): PrivacySettings {
  if (!settings) {
    return {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    };
  }

  return {
    show_phone: settings.show_phone,
    show_address: settings.show_address,
    hide_from_search: settings.hide_from_search ?? false,
    show_in_directory: settings.show_in_directory ?? false,
  };
}

/**
 * Parses privacy settings from a raw JSON string (as stored in D1).
 * Handles null, invalid JSON, and missing fields with safe defaults.
 */
export function parsePrivacySettings(raw: string | null): PrivacySettings {
  if (!raw) {
    return normalizePrivacySettings(null);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizePrivacySettings(isValidPrivacySettings(parsed) ? parsed : null);
  } catch {
    return normalizePrivacySettings(null);
  }
}
