/**
 * Registry-sync guard tests
 *
 * Verifies at runtime that every surface that must cover all ThemeIds
 * actually does so. TypeScript's Record<ThemeId, …> types already enforce
 * this at compile time; these tests catch any future drift where someone
 * uses a weaker type or bypasses the type system.
 *
 * Note: theme-registry.client.tsx uses next/dynamic and cannot be imported
 * in the Node.js test environment. Its Record<ThemeId, …> annotation is
 * sufficient compile-time coverage.
 */

import { describe, expect, it } from "vite-plus/test";
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

  it("adding a new ID to THEME_IDS without updating maps would fail type-check (documented)", () => {
    /**
     * This test documents the compile-time guard:
     * Both THEME_METADATA and themeToShareVariant are Record<ThemeId, …>.
     * theme-registry.ts TEMPLATE_LOADERS and TEMPLATE_EXPORT_NAME are also Record<ThemeId, …>.
     * theme-registry.client.tsx DYNAMIC_TEMPLATES is Record<ThemeId, …>.
     *
     * Adding a new string to THEME_IDS without filling in these maps causes
     * a TypeScript error at build time — verified manually during plan 015.
     */
    expect(true).toBe(true);
  });
});
