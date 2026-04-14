import { describe, expect, it } from "vitest";
import { parsePreviewSkills } from "@/lib/utils/preview-skills";

describe("parsePreviewSkills", () => {
  it("parses valid JSON array strings", () => {
    expect(parsePreviewSkills('["TypeScript","React"]')).toEqual(["TypeScript", "React"]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parsePreviewSkills("{invalid-json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parsePreviewSkills('{"skill":"TypeScript"}')).toEqual([]);
  });

  it("filters non-string and blank values", () => {
    expect(parsePreviewSkills('[" TypeScript ",42,null,"",true,"React"]')).toEqual([
      "TypeScript",
      "React",
    ]);
  });
});
