import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS_JSON,
  extractCityState,
  normalizePrivacySettings,
} from "@/lib/utils/privacy";

// ── extractCityState ─────────────────────────────────────────────────

describe("extractCityState", () => {
  it("extracts city/state from full address with ZIP", () => {
    expect(extractCityState("123 Main St, San Francisco, CA 94102")).toBe("San Francisco, CA");
  });

  it("extracts city/state from full address without ZIP", () => {
    expect(extractCityState("123 Main St, San Francisco, CA")).toBe("San Francisco, CA");
  });

  it("returns city/state as-is when already in that format", () => {
    expect(extractCityState("San Francisco, CA")).toBe("San Francisco, CA");
  });

  it("strips ZIP from City, State ZIP format", () => {
    expect(extractCityState("New York, NY 10001")).toBe("New York, NY");
  });

  it("returns city name when no state detected", () => {
    expect(extractCityState("Portland")).toBe("Portland");
  });

  it("returns empty string for empty/null/undefined input", () => {
    expect(extractCityState("")).toBe("");
    expect(extractCityState(undefined)).toBe("");
    expect(extractCityState("   ")).toBe("");
  });

  it("handles multi-part international-style addresses", () => {
    // Falls into the last-two-parts fallback
    const result = extractCityState("10 Downing Street, London, UK");
    expect(result).toContain("London");
  });

  it("does not treat street-number-only input as city (fail closed)", () => {
    // "123 Main St" starts with a digit — should not return as-is for single-part
    const result = extractCityState("123 Main St");
    // Since there's no comma, parts.length === 1, hasStreetNumber = true.
    // The final fallback fails CLOSED (returns "") rather than leaking the raw
    // street address (item 15).
    expect(result).toBe("");
  });

  it("fails closed on unparseable single-part street addresses", () => {
    expect(extractCityState("999 Elm Blvd")).toBe("");
    // A single-part string that looks like a bare street (no city/state) must
    // never be returned verbatim by a privacy filter.
    expect(extractCityState("100 Main Street")).toBe("");
  });
});

// ── normalizePrivacySettings ─────────────────────────────────────────

describe("normalizePrivacySettings", () => {
  it("returns defaults for null input", () => {
    expect(normalizePrivacySettings(null)).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    });
  });

  it("fills missing optional fields with defaults", () => {
    const result = normalizePrivacySettings({
      show_phone: true,
      show_address: true,
    });
    expect(result).toEqual({
      show_phone: true,
      show_address: true,
      hide_from_search: false,
      show_in_directory: true,
    });
  });

  it("preserves all provided fields", () => {
    const input = {
      show_phone: true,
      show_address: false,
      hide_from_search: true,
      show_in_directory: true,
    };
    expect(normalizePrivacySettings(input)).toEqual(input);
  });
});

// ── DEFAULT_PRIVACY_SETTINGS alignment (Step 4) ──────────────────────

describe("DEFAULT_PRIVACY_SETTINGS alignment", () => {
  it("normalizePrivacySettings(null) deep-equals DEFAULT_PRIVACY_SETTINGS", () => {
    expect(normalizePrivacySettings(null)).toEqual(DEFAULT_PRIVACY_SETTINGS);
  });

  it("DEFAULT_PRIVACY_SETTINGS.show_in_directory is true", () => {
    expect(DEFAULT_PRIVACY_SETTINGS.show_in_directory).toBe(true);
  });

  it("JSON.parse(DEFAULT_PRIVACY_SETTINGS_JSON) deep-equals DEFAULT_PRIVACY_SETTINGS", () => {
    expect(JSON.parse(DEFAULT_PRIVACY_SETTINGS_JSON)).toEqual(DEFAULT_PRIVACY_SETTINGS);
  });
});
