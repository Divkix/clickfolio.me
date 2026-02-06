import { describe, expect, it } from "vitest";
import {
  extractCityState,
  isValidPrivacySettings,
  normalizePrivacySettings,
  parsePrivacySettings,
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

  it("does not treat street-number-only input as city", () => {
    // "123 Main St" starts with a digit — should not return as-is for single-part
    const result = extractCityState("123 Main St");
    // Since there's no comma, parts.length === 1, hasStreetNumber = true
    // Falls through to fallback which returns normalized
    expect(result).toBe("123 Main St");
  });
});

// ── isValidPrivacySettings ───────────────────────────────────────────

describe("isValidPrivacySettings", () => {
  it("returns true for valid settings with all fields", () => {
    expect(
      isValidPrivacySettings({
        show_phone: true,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      }),
    ).toBe(true);
  });

  it("returns true for valid settings with only required fields (backward compat)", () => {
    expect(
      isValidPrivacySettings({
        show_phone: false,
        show_address: true,
      }),
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isValidPrivacySettings(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isValidPrivacySettings("string")).toBe(false);
    expect(isValidPrivacySettings(42)).toBe(false);
    expect(isValidPrivacySettings(true)).toBe(false);
  });

  it("returns false when show_phone is not boolean", () => {
    expect(
      isValidPrivacySettings({
        show_phone: "yes",
        show_address: false,
      }),
    ).toBe(false);
  });

  it("returns false when show_address is missing", () => {
    expect(isValidPrivacySettings({ show_phone: true })).toBe(false);
  });

  it("returns false when hide_from_search is wrong type", () => {
    expect(
      isValidPrivacySettings({
        show_phone: true,
        show_address: true,
        hide_from_search: "true",
      }),
    ).toBe(false);
  });
});

// ── normalizePrivacySettings ─────────────────────────────────────────

describe("normalizePrivacySettings", () => {
  it("returns defaults for null input", () => {
    expect(normalizePrivacySettings(null)).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
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
      show_in_directory: false,
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

// ── parsePrivacySettings ─────────────────────────────────────────────

describe("parsePrivacySettings", () => {
  it("parses valid JSON string", () => {
    const raw = JSON.stringify({ show_phone: true, show_address: false });
    const result = parsePrivacySettings(raw);
    expect(result.show_phone).toBe(true);
    expect(result.show_address).toBe(false);
    expect(result.hide_from_search).toBe(false);
    expect(result.show_in_directory).toBe(false);
  });

  it("returns defaults for null input", () => {
    expect(parsePrivacySettings(null)).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    });
  });

  it("returns defaults for empty string", () => {
    expect(parsePrivacySettings("")).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    });
  });

  it("returns defaults for invalid JSON", () => {
    expect(parsePrivacySettings("{invalid json")).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    });
  });

  it("returns defaults for valid JSON that fails type guard", () => {
    expect(parsePrivacySettings(JSON.stringify({ show_phone: "yes" }))).toEqual({
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    });
  });
});
