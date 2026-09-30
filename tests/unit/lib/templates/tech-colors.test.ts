import { describe, expect, it } from "vite-plus/test";
import { techDotColor } from "@/lib/templates/tech-colors";

describe("techDotColor", () => {
  const go = techDotColor("Go");

  it("matches a technology by its exact name, ignoring case and whitespace", () => {
    expect(techDotColor(" go ")).toBe(go);
    expect(techDotColor("Golang")).toBe(go);
    expect(techDotColor("TypeScript")).toBe(techDotColor("ts"));
  });

  it("does not colour names that merely contain another technology", () => {
    for (const tech of ["Google", "MongoDB", "Django", "Algorithms", "Cargo"]) {
      expect(techDotColor(tech), tech).not.toBe(go);
    }

    expect(techDotColor("Reactive Extensions")).not.toBe(techDotColor("React"));
  });

  it("falls back to a neutral colour for unknown technologies", () => {
    expect(techDotColor("Cobra")).toBe(techDotColor("Some Internal Tool"));
  });
});
