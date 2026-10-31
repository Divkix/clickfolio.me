import { describe, expect, it } from "vite-plus/test";
import { handleSchema, normalizeHandleInput } from "@/lib/schemas/handle";

describe("normalizeHandleInput", () => {
  it.each([
    ["lucía", "lucia"],
    ["García", "garcia"],
    ["Peña", "pena"],
    ["lucía-fernández-garcía", "lucia-fernandez-garcia"],
    ["Inès Moreau", "inesmoreau"],
    ["Zoe\u0308 Patterson", "zoepatterson"],
  ])("keeps the letters in %s when removing accents", (name, expected) => {
    const handle = normalizeHandleInput(name);

    expect(handle).toBe(expected);
    expect(handleSchema.safeParse(handle).success).toBe(true);
  });

  it("keeps an empty result empty so the user must choose a handle", () => {
    expect(normalizeHandleInput("李雷")).toBe("");
    expect(normalizeHandleInput("")).toBe("");
    expect(handleSchema.safeParse(normalizeHandleInput("李雷")).success).toBe(false);
  });

  it("keeps a hyphen typed one key at a time", () => {
    const typed = [..."lucía-fernández"].reduce(
      (value, key) => normalizeHandleInput(value + key),
      "",
    );

    expect(typed).toBe("lucia-fernandez");
    expect(handleSchema.safeParse(typed).success).toBe(true);
  });

  it("collapses hyphens and caps length, leaving a trailing hyphen for the schema to reject", () => {
    const handle = normalizeHandleInput("--alice---dev--");

    expect(handle).toBe("alice-dev-");
    expect(handleSchema.safeParse(handle).success).toBe(false);
    expect(normalizeHandleInput("é".repeat(40))).toBe("e".repeat(30));
  });
});
