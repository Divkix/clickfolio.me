/**
 * Theme IDs and metadata unit tests
 * Tests for lib/templates/theme-ids.ts
 */

import { describe, expect, it } from "vitest";
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

describe("Free themes (0 referrals required)", () => {
  const freeThemes = THEME_IDS.filter((id) => THEME_METADATA[id].referralsRequired === 0);

  it("includes the expected free themes", () => {
    expect(freeThemes).toContain("bento");
    expect(freeThemes).toContain("classic_ats");
    expect(freeThemes).toContain("dev_terminal");
    expect(freeThemes).toContain("glass");
    expect(freeThemes).toContain("minimalist_editorial");
    expect(freeThemes).toContain("neo_brutalist");
  });

  it("has 6 free themes", () => {
    expect(freeThemes).toHaveLength(6);
  });
});

describe("Premium themes (referral-gated)", () => {
  it("design_folio requires 3 referrals", () => {
    expect(THEME_METADATA.design_folio.referralsRequired).toBe(3);
  });

  it("spotlight requires 3 referrals", () => {
    expect(THEME_METADATA.spotlight.referralsRequired).toBe(3);
  });

  it("midnight requires 5 referrals", () => {
    expect(THEME_METADATA.midnight.referralsRequired).toBe(5);
  });

  it("bold_corporate requires 10 referrals", () => {
    expect(THEME_METADATA.bold_corporate.referralsRequired).toBe(10);
  });

  it("has 4 premium themes total", () => {
    const premiumThemes = THEME_IDS.filter((id) => THEME_METADATA[id].referralsRequired > 0);
    expect(premiumThemes).toHaveLength(4);
  });
});

describe("isThemeUnlocked", () => {
  describe("with pro status", () => {
    it("unlocks all themes when isPro is true", () => {
      for (const themeId of THEME_IDS) {
        expect(isThemeUnlocked(themeId, 0, true)).toBe(true);
        expect(isThemeUnlocked(themeId, 100, true)).toBe(true);
      }
    });

    it("ignores referral count when isPro is true", () => {
      expect(isThemeUnlocked("bold_corporate", 0, true)).toBe(true);
      expect(isThemeUnlocked("midnight", 0, true)).toBe(true);
    });
  });

  describe("without pro status", () => {
    it("unlocks free themes with 0 referrals", () => {
      for (const themeId of THEME_IDS) {
        if (THEME_METADATA[themeId].referralsRequired === 0) {
          expect(isThemeUnlocked(themeId, 0, false)).toBe(true);
        }
      }
    });

    it("unlocks 3-referral themes at exactly 3 referrals", () => {
      expect(isThemeUnlocked("design_folio", 3, false)).toBe(true);
      expect(isThemeUnlocked("spotlight", 3, false)).toBe(true);
    });

    it("locks 3-referral themes below threshold", () => {
      expect(isThemeUnlocked("design_folio", 2, false)).toBe(false);
      expect(isThemeUnlocked("spotlight", 0, false)).toBe(false);
    });

    it("unlocks 5-referral themes at exactly 5 referrals", () => {
      expect(isThemeUnlocked("midnight", 5, false)).toBe(true);
    });

    it("locks 5-referral themes below threshold", () => {
      expect(isThemeUnlocked("midnight", 4, false)).toBe(false);
      expect(isThemeUnlocked("midnight", 0, false)).toBe(false);
    });

    it("unlocks 10-referral themes at exactly 10 referrals", () => {
      expect(isThemeUnlocked("bold_corporate", 10, false)).toBe(true);
    });

    it("locks 10-referral themes below threshold", () => {
      expect(isThemeUnlocked("bold_corporate", 9, false)).toBe(false);
      expect(isThemeUnlocked("bold_corporate", 0, false)).toBe(false);
    });

    it("unlocks themes when referral count exceeds threshold", () => {
      expect(isThemeUnlocked("design_folio", 10, false)).toBe(true);
      expect(isThemeUnlocked("spotlight", 10, false)).toBe(true);
      expect(isThemeUnlocked("midnight", 10, false)).toBe(true);
      expect(isThemeUnlocked("bold_corporate", 15, false)).toBe(true);
    });

    it("defaults isPro to false", () => {
      // Testing the default parameter behavior
      expect(isThemeUnlocked("bold_corporate", 0)).toBe(false);
      expect(isThemeUnlocked("minimalist_editorial", 0)).toBe(true);
    });
  });
});

describe("getThemeReferralRequirement", () => {
  it("returns 0 for free themes", () => {
    expect(getThemeReferralRequirement("minimalist_editorial")).toBe(0);
    expect(getThemeReferralRequirement("bento")).toBe(0);
    expect(getThemeReferralRequirement("classic_ats")).toBe(0);
  });

  it("returns correct requirement for premium themes", () => {
    expect(getThemeReferralRequirement("design_folio")).toBe(3);
    expect(getThemeReferralRequirement("spotlight")).toBe(3);
    expect(getThemeReferralRequirement("midnight")).toBe(5);
    expect(getThemeReferralRequirement("bold_corporate")).toBe(10);
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
