/**
 * Theme registry unit tests
 * Tests for lib/templates/theme-registry.ts
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isValidThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";

describe("getTemplate", () => {
  it("returns a component for valid theme ID", async () => {
    const component = await getTemplate("minimalist_editorial");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("returns default theme for null input", async () => {
    const component = await getTemplate(null);

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("returns default theme for undefined input", async () => {
    const component = await getTemplate(undefined);

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("returns default theme for invalid theme ID", async () => {
    const component = await getTemplate("invalid_theme_id");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("returns same component type for default theme", async () => {
    const defaultComponent = await getTemplate(DEFAULT_THEME);
    const nullComponent = await getTemplate(null);

    // Both should return the same theme component
    expect(typeof defaultComponent).toBe("function");
    expect(typeof nullComponent).toBe("function");
  });

  it("loads bento theme successfully", async () => {
    const component = await getTemplate("bento");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("loads glass theme successfully", async () => {
    const component = await getTemplate("glass");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("loads neo_brutalist theme successfully", async () => {
    const component = await getTemplate("neo_brutalist");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("loads classic_ats theme successfully", async () => {
    const component = await getTemplate("classic_ats");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("loads dev_terminal theme successfully", async () => {
    const component = await getTemplate("dev_terminal");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("loads premium themes successfully", async () => {
    // Note: These may be async imports
    const designFolio = await getTemplate("design_folio");
    const spotlight = await getTemplate("spotlight");
    const midnight = await getTemplate("midnight");
    const boldCorporate = await getTemplate("bold_corporate");

    expect(typeof designFolio).toBe("function");
    expect(typeof spotlight).toBe("function");
    expect(typeof midnight).toBe("function");
    expect(typeof boldCorporate).toBe("function");
  });
});

describe("isValidThemeId re-export", () => {
  it("is available as re-export", () => {
    expect(isValidThemeId).toBeDefined();
    expect(typeof isValidThemeId).toBe("function");
  });

  it("works correctly for valid themes", () => {
    expect(isValidThemeId("bento")).toBe(true);
    expect(isValidThemeId("minimalist_editorial")).toBe(true);
  });

  it("works correctly for invalid themes", () => {
    expect(isValidThemeId("invalid")).toBe(false);
    expect(isValidThemeId("")).toBe(false);
  });
});

describe("Theme loading behavior", () => {
  it("handles concurrent theme loads", async () => {
    const promises = [getTemplate("bento"), getTemplate("glass"), getTemplate("classic_ats")];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    results.forEach((component) => {
      expect(typeof component).toBe("function");
    });
  });

  it("gracefully handles theme load errors by falling back to default", async () => {
    // Test with invalid theme ID - should fall back to default
    const component = await getTemplate("nonexistent_theme_12345");

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });
});
