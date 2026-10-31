import { describe, expect, it } from "vite-plus/test";
import { normalizeResumeDescriptions } from "@/lib/ai/normalize-descriptions";
import { transformAiOutput } from "@/lib/ai/transform";
import type { ResumeContent } from "@/lib/types/database";

function resume(description: string, highlights?: string[]): ResumeContent {
  return {
    full_name: "Alex Rivera",
    headline: "Engineer",
    summary: "Builds reliable software.",
    contact: { email: "alex@example.com" },
    experience: [
      { title: "Engineer", company: "Example", start_date: "2020", description, highlights },
    ],
  };
}

describe("normalizeResumeDescriptions", () => {
  it.each([
    ["Built reliable services.", ["Built reliable services."]],
    ["  BUILT\n reliable   services!!! ", ["Built reliable services."]],
    ["Diseñó servicios en Go…", ["Diseñó servicios en Go."]],
    ["Built features Fixed bugs", ["Built features", "Fixed bugs"]],
    ["Built features. Fixed bugs.", ["Built features.", "Fixed bugs."]],
    ["Built features Fixed bugs.", ["Built features.", "Fixed bugs!"]],
    ["Fixed bugs", ["Built features", "Fixed bugs."]],
  ])("removes a paragraph repeating its bullets: %s", (description, highlights) => {
    const input = resume(description, highlights);
    const result = normalizeResumeDescriptions(input);

    expect(result.experience[0].description).toBe("");
    expect(result.experience[0].highlights).toEqual(highlights);
    expect(input.experience[0].description).toBe(description);
  });

  it.each([
    ["Led the platform team.", ["Built reliable services."]],
    ["Built reliable services with a team of six.", ["Built reliable services."]],
    ["Built reliable services.", undefined],
    ["Built reliable services.", []],
  ])("keeps a distinct paragraph or one without bullets: %s", (description, highlights) => {
    const input = resume(description, highlights);

    expect(normalizeResumeDescriptions(input).experience[0]).toEqual(input.experience[0]);
  });

  it("normalizes project highlights when present without dropping standalone descriptions", () => {
    const input = {
      ...resume("", []),
      projects: [
        { title: "App", description: "Shipped an app.", highlights: ["Shipped an app!"] },
        { title: "Library", description: "A reusable library." },
      ],
    };

    expect(
      normalizeResumeDescriptions(input).projects?.map((project) => project.description),
    ).toEqual(["", "A reusable library."]);
  });

  it.each([
    '{"experience":null,"projects":null}',
    '{"experience":[{}]}',
    '{"experience":[{"description":12,"highlights":["Built services"]}]}',
    '{"experience":[{"description":"Built services","highlights":["Built services",12]}]}',
  ])("preserves legacy stored shapes without throwing: %s", (json) => {
    const input: ResumeContent = JSON.parse(json);

    expect(normalizeResumeDescriptions(input)).toEqual(input);
  });

  it("applies normalization to newly parsed output", () => {
    const result = transformAiOutput(
      resume("Built reliable services.", ["Built reliable services."]),
    );

    expect(result.experience[0].description).toBe("");
    expect(result.experience[0].highlights).toEqual(["Built reliable services."]);
  });
});
