/**
 * Test to verify theme ID consistency across components
 * Issue #81: Theme ID drift in CTA and AttributionWidget
 */
import { describe, expect, it } from "vitest";
import { isValidThemeId, THEME_IDS } from "@/lib/templates/theme-ids";

describe("Theme ID Consistency", () => {
  describe("canonical theme IDs", () => {
    it("should include 'bento' as a valid theme ID", () => {
      expect(THEME_IDS).toContain("bento");
    });

    it("should include 'glass' as a valid theme ID", () => {
      expect(THEME_IDS).toContain("glass");
    });

    it("should NOT include 'glass_morphic' as a valid theme ID", () => {
      expect(THEME_IDS).not.toContain("glass_morphic");
    });

    it("should NOT include 'glassmorphic' as a valid theme ID", () => {
      expect(THEME_IDS).not.toContain("glassmorphic");
    });

    it("should NOT include 'bento_grid' as a valid theme ID", () => {
      expect(THEME_IDS).not.toContain("bento_grid");
    });
  });

  describe("type guard validation", () => {
    it("should validate 'bento' as a valid ThemeId", () => {
      expect(isValidThemeId("bento")).toBe(true);
    });

    it("should validate 'glass' as a valid ThemeId", () => {
      expect(isValidThemeId("glass")).toBe(true);
    });

    it("should NOT validate 'glass_morphic' as a valid ThemeId", () => {
      expect(isValidThemeId("glass_morphic")).toBe(false);
    });

    it("should NOT validate 'glassmorphic' as a valid ThemeId", () => {
      expect(isValidThemeId("glassmorphic")).toBe(false);
    });

    it("should NOT validate 'bento_grid' as a valid ThemeId", () => {
      expect(isValidThemeId("bento_grid")).toBe(false);
    });
  });
});
