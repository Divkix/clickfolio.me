import { describe, expect, it } from "vite-plus/test";
import { SHARE_VARIANT_KEYS } from "@/lib/templates/share-variants";
import { THEME_IDS, THEME_METADATA, themeToShareVariant } from "@/lib/templates/theme-ids";

describe("Registry sync guard", () => {
  it("THEME_METADATA covers every entry in THEME_IDS", () => {
    for (const id of THEME_IDS) {
      expect(THEME_METADATA[id]).toBeDefined();
    }
  });

  it("THEME_METADATA has no extra keys beyond THEME_IDS", () => {
    const metadataKeys = Object.keys(THEME_METADATA).sort();
    const themeIdsSorted = [...THEME_IDS].sort();
    expect(metadataKeys).toEqual(themeIdsSorted);
  });

  it("themeToShareVariant covers every entry in THEME_IDS", () => {
    for (const id of THEME_IDS) {
      expect(themeToShareVariant[id]).toBeDefined();
    }
  });

  it("themeToShareVariant has no extra keys beyond THEME_IDS", () => {
    const variantKeys = Object.keys(themeToShareVariant).sort();
    const themeIdsSorted = [...THEME_IDS].sort();
    expect(variantKeys).toEqual(themeIdsSorted);
  });

  it("every THEME_ID appears in THEME_IDS exactly once", () => {
    const seen = new Set<string>();
    for (const id of THEME_IDS) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(THEME_IDS.length);
  });

  it("THEME_METADATA and themeToShareVariant have the same key set (cross-check)", () => {
    const metadataKeys = Object.keys(THEME_METADATA).sort();
    const variantKeys = Object.keys(themeToShareVariant).sort();
    expect(metadataKeys).toEqual(variantKeys);
  });

  it("themeToShareVariant values match SHARE_VARIANT_KEYS exactly (cross-check)", () => {
    const mapped = Object.values(themeToShareVariant).sort();
    const keys = [...SHARE_VARIANT_KEYS].sort();
    expect(mapped).toEqual(keys);
  });
});
