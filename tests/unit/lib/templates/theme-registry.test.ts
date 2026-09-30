import { describe, expect, it } from "vite-plus/test";
import { getTemplate } from "@/lib/templates/theme-registry";

describe("getTemplate", () => {
  it("returns a component for valid theme ID", async () => {
    const component = await getTemplate("minimalist_editorial");

    expect(component).toBeDefined();
    expect(component).toBeInstanceOf(Function);
  });

  it("returns default theme for null input", async () => {
    const component = await getTemplate(null);

    expect(component).toBeDefined();
    expect(component).toBeInstanceOf(Function);
  });

  it("returns default theme for invalid theme ID", async () => {
    const component = await getTemplate("invalid_theme_id");

    expect(component).toBeDefined();
    expect(component).toBeInstanceOf(Function);
  });
});

describe("Theme loading behavior", () => {
  it("gracefully handles theme load errors by falling back to default", async () => {
    const component = await getTemplate("nonexistent_theme_12345");

    expect(component).toBeDefined();
    expect(component).toBeInstanceOf(Function);
  });
});
