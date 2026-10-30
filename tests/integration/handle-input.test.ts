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

  it("keeps normalized handles within the schema's length and hyphen rules", () => {
    const handle = normalizeHandleInput(`--${"é".repeat(29)}---more--`);

    expect(handle).toBe("e".repeat(29));
    expect(handleSchema.safeParse(handle).success).toBe(true);
    expect(normalizeHandleInput("--alice---dev--")).toBe("alice-dev");
  });
});
