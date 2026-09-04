const FULL_ADDRESS_WITH_ZIP = /,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
const STATE_CODE = /^[A-Z]{2}$/;
const CITY_STATE_PATTERN = /^([^,]+),\s*([A-Z]{2})$/;
const CITY_STATE_ZIP = /^([^,]+),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/;
const STREET_NUMBER = /^\d+\s/;

export function extractCityState(location: string | undefined): string {
  if (!location || location.trim() === "") {
    return "";
  }

  const normalized = location.trim().replace(/\s+/g, " ");

  const matchWithZip = normalized.match(FULL_ADDRESS_WITH_ZIP);
  if (matchWithZip) {
    return `${matchWithZip[1]}, ${matchWithZip[2]}`;
  }

  const parts = normalized.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const state = parts[parts.length - 1];
    const city = parts[parts.length - 2];

    if (STATE_CODE.test(state)) {
      return `${city}, ${state}`;
    }
  }

  const matchCityState = normalized.match(CITY_STATE_PATTERN);
  if (matchCityState) {
    return normalized;
  }

  const matchCityStateZip = normalized.match(CITY_STATE_ZIP);
  if (matchCityStateZip) {
    return `${matchCityStateZip[1]}, ${matchCityStateZip[2]}`;
  }

  const hasStreetNumber = STREET_NUMBER.test(normalized);
  if (!hasStreetNumber && parts.length === 1) {
    return normalized;
  }

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    if (STATE_CODE.test(last)) {
      return `${secondLast}, ${last}`;
    }

    return `${secondLast}, ${last}`;
  }

  return "";
}

import type { PrivacySettings } from "@/lib/db/schema/auth";

export type { PrivacySettings };

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  show_phone: false,
  show_address: false,
  hide_from_search: false,
  show_in_directory: true,
};

export const DEFAULT_PRIVACY_SETTINGS_JSON = JSON.stringify(DEFAULT_PRIVACY_SETTINGS);
export function normalizePrivacySettings(
  settings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search?: boolean;
    show_in_directory?: boolean;
  } | null,
): PrivacySettings {
  if (!settings) {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }

  return {
    show_phone: settings.show_phone,
    show_address: settings.show_address,
    hide_from_search: settings.hide_from_search ?? DEFAULT_PRIVACY_SETTINGS.hide_from_search,
    show_in_directory: settings.show_in_directory ?? DEFAULT_PRIVACY_SETTINGS.show_in_directory,
  };
}
