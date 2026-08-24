/**
 * Theme IDs and metadata unit tests
 * Tests for lib/templates/theme-ids.ts
 */

import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_THEME,
  getThemeReferralRequirement,
  isThemeUnlocked,
  isValidThemeId,
  THEME_IDS,
  THEME_METADATA,
  type ThemeId,
} from "@/lib/templates/theme-ids";

describe("THEME_IDS", () => {
  it("contains all expected theme IDs", () => {
    expect(THEME_IDS).toHaveLength(10);
    expect(THEME_IDS).toContain("bento");
    expect(THEME_IDS).toContain("bold_corporate");
    expect(THEME_IDS).toContain("classic_ats");
    expect(THEME_IDS).toContain("design_folio");
    expect(THEME_IDS).toContain("dev_terminal");
    expect(THEME_IDS).toContain("glass");
    expect(THEME_IDS).toContain("midnight");
    expect(THEME_IDS).toContain("minimalist_editorial");
    expect(THEME_IDS).toContain("neo_brutalist");
    expect(THEME_IDS).toContain("spotlight");
  });

  it("is readonly", () => {
    // Type-level check - array should not be modifiable at compile time
    expect(Array.isArray(THEME_IDS)).toBe(true);
  });
});

describe("DEFAULT_THEME", () => {
  it("is set to minimalist_editorial", () => {
    expect(DEFAULT_THEME).toBe("minimalist_editorial");
  });

  it("is a valid theme ID", () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });
});

describe("isValidThemeId", () => {
  it("returns true for valid theme IDs", () => {
    expect(isValidThemeId("bento")).toBe(true);
    expect(isValidThemeId("minimalist_editorial")).toBe(true);
    expect(isValidThemeId("midnight")).toBe(true);
  });

  it("returns false for invalid theme IDs", () => {
    expect(isValidThemeId("invalid")).toBe(false);
    expect(isValidThemeId("")).toBe(false);
    expect(isValidThemeId("random")).toBe(false);
  });

  it("returns false for similar but invalid names", () => {
    expect(isValidThemeId("bento_grid")).toBe(false);
    expect(isValidThemeId("Minimalist_Editorial")).toBe(false);
    expect(isValidThemeId("MIDNIGHT")).toBe(false);
  });

  it("acts as a type guard", () => {
    const value = "bento";
    if (isValidThemeId(value)) {
      // TypeScript should narrow value to ThemeId here
      const themeId: ThemeId = value;
      expect(themeId).toBe("bento");
    }
  });
});

describe("THEME_METADATA", () => {
  it("has metadata for all theme IDs", () => {
    for (const themeId of THEME_IDS) {
      expect(THEME_METADATA[themeId]).toBeDefined();
    }
  });

  it("contains required fields for all themes", () => {
    for (const themeId of THEME_IDS) {
      const metadata = THEME_METADATA[themeId];
      expect(metadata.name).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(metadata.category).toBeDefined();
      expect(metadata.preview).toBeDefined();
      expect(typeof metadata.referralsRequired).toBe("number");
    }
  });

  it("has unique theme names", () => {
    const names = THEME_IDS.map((id) => THEME_METADATA[id].name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("has valid preview paths", () => {
    for (const themeId of THEME_IDS) {
      const preview = THEME_METADATA[themeId].preview;
      expect(preview).toMatch(/^\/previews\/.+\.(webp|png|jpg)$/);
    }
  });

  it("has non-empty names and descriptions", () => {
    for (const themeId of THEME_IDS) {
      const metadata = THEME_METADATA[themeId];
      expect(metadata.name.length).toBeGreaterThan(0);
      expect(metadata.description.length).toBeGreaterThan(0);
    }
  });
});

describe("All themes are free", () => {
  it("every theme has referralsRequired of 0", () => {
    for (const themeId of THEME_IDS) {
      expect(THEME_METADATA[themeId].referralsRequired).toBe(0);
    }
  });
});

describe("isThemeUnlocked", () => {
  it("always returns true, ignoring legacy referral/pro arguments", () => {
    for (const themeId of THEME_IDS) {
      expect(isThemeUnlocked(themeId)).toBe(true);
      expect(isThemeUnlocked(themeId, 0)).toBe(true);
      expect(isThemeUnlocked(themeId, 0, false)).toBe(true);
      expect(isThemeUnlocked(themeId, 100, true)).toBe(true);
    }
  });
});

describe("getThemeReferralRequirement", () => {
  it("returns 0 for every theme", () => {
    for (const themeId of THEME_IDS) {
      expect(getThemeReferralRequirement(themeId)).toBe(0);
    }
  });
});

describe("Theme categories", () => {
  it("has Professional category themes", () => {
    const professional = THEME_IDS.filter((id) => THEME_METADATA[id].category === "Professional");
    expect(professional.length).toBeGreaterThan(0);
    expect(professional).toContain("classic_ats");
    expect(professional).toContain("minimalist_editorial");
  });

  it("has Modern category themes", () => {
    const modern = THEME_IDS.filter((id) => THEME_METADATA[id].category === "Modern");
    expect(modern.length).toBeGreaterThan(0);
    expect(modern).toContain("bento");
    expect(modern).toContain("glass");
    expect(modern).toContain("midnight");
  });

  it("has Creative category themes", () => {
    const creative = THEME_IDS.filter((id) => THEME_METADATA[id].category === "Creative");
    expect(creative.length).toBeGreaterThan(0);
    expect(creative).toContain("design_folio");
    expect(creative).toContain("neo_brutalist");
    expect(creative).toContain("spotlight");
  });

  it("has Developer category themes", () => {
    const developer = THEME_IDS.filter((id) => THEME_METADATA[id].category === "Developer");
    expect(developer).toContain("dev_terminal");
  });
});
