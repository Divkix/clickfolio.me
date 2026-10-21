import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_THEME,
  isValidThemeId,
  REMOVED_THEME_REPLACEMENTS,
  replacementForRemovedTheme,
  resolveThemeId,
  THEME_IDS,
} from "@/lib/templates/theme-ids";

describe("resolveThemeId", () => {
  it("passes every current theme id through unchanged", () => {
    for (const id of THEME_IDS) {
      expect(resolveThemeId(id)).toBe(id);
    }
  });

  it("maps every removed theme id to its replacement", () => {
    for (const [removed, replacement] of Object.entries<string>(REMOVED_THEME_REPLACEMENTS)) {
      expect(isValidThemeId(removed)).toBe(false);
      expect(isValidThemeId(replacement)).toBe(true);
      expect(resolveThemeId(removed)).toBe(replacement);
    }
  });

  it("falls back to the default theme for missing or unknown ids", () => {
    expect(resolveThemeId(null)).toBe(DEFAULT_THEME);
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME);
    expect(resolveThemeId("")).toBe(DEFAULT_THEME);
    expect(resolveThemeId("not_a_theme")).toBe(DEFAULT_THEME);
    expect(resolveThemeId("toString")).toBe(DEFAULT_THEME);
  });
});

describe("replacementForRemovedTheme", () => {
  it("returns null for current and unknown ids", () => {
    expect(replacementForRemovedTheme(DEFAULT_THEME)).toBeNull();
    expect(replacementForRemovedTheme("not_a_theme")).toBeNull();
    expect(replacementForRemovedTheme("__proto__")).toBeNull();
  });
});
