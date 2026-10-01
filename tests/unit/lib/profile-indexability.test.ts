import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import type { ResumeContent } from "@/lib/types/database";
import { calculateCompleteness } from "@/lib/utils/profile-completeness";

vi.mock("@/lib/utils/profile-completeness", () => ({
  calculateCompleteness: vi.fn(),
}));

const makeContent = (overrides: Partial<ResumeContent> = {}): ResumeContent => ({
  full_name: "Ada Lovelace",
  headline: "Mathematician",
  summary: "A mathematician and writer. ".repeat(25).trim(),
  contact: { email: "ada@example.com" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
  ...overrides,
});

const experience = {
  title: "Analyst",
  company: "Analytical Engine Co.",
  start_date: "1842",
  description: "Wrote programs for the Analytical Engine.",
};

describe("isIndexableProfile", () => {
  beforeEach(() => {
    vi.mocked(calculateCompleteness).mockReturnValue(40);
  });

  // SAFETY: Literal tuples preserve each word count and its expected boolean result.
  it.each([
    [99, false],
    [100, true],
  ] as const)("requires at least 100 visible words (%i words → %s)", (words, expected) => {
    const content = makeContent({
      contact: { email: undefined },
      summary: ` ${"writer\t\n".repeat(words - 6)} `,
      education: [{ degree: "Mathematics", institution: "London University" }],
    });

    expect(isIndexableProfile(content, { hide_from_search: false })).toBe(expected);
  });

  it("counts words in experience descriptions", () => {
    const content = makeContent({
      contact: { email: undefined },
      summary: "",
      experience: [{ ...experience, description: "writer ".repeat(92) }],
    });

    expect(isIndexableProfile(content, { hide_from_search: false })).toBe(true);
    content.experience[0].description = "writer ".repeat(91);
    expect(isIndexableProfile(content, { hide_from_search: false })).toBe(false);
  });

  it("uses 40 as the completeness boundary", () => {
    vi.mocked(calculateCompleteness).mockReturnValueOnce(39);
    expect(
      isIndexableProfile(makeContent({ experience: [experience] }), { hide_from_search: false }),
    ).toBe(false);

    vi.mocked(calculateCompleteness).mockReturnValue(40);
    expect(
      isIndexableProfile(makeContent({ experience: [experience] }), { hide_from_search: false }),
    ).toBe(true);
  });

  it("respects hide_from_search independently of profile quality", () => {
    vi.mocked(calculateCompleteness).mockReturnValue(100);

    expect(
      isIndexableProfile(makeContent({ experience: [experience] }), { hide_from_search: true }),
    ).toBe(false);
  });

  it.each([
    ["unknown", "full_name"],
    ["untitled", "full_name"],
    ["your name", "full_name"],
    ["your headline", "full_name"],
    ["test", "full_name"],
    ["resume", "full_name"],
    ["cv", "full_name"],
    ["john doe", "full_name"],
    ["jane doe", "full_name"],
    ["unknown", "headline"],
    ["untitled", "headline"],
    ["your name", "headline"],
    ["your headline", "headline"],
    ["test", "headline"],
    ["resume", "headline"],
    ["cv", "headline"],
    ["john doe", "headline"],
    ["jane doe", "headline"],
  ] as const)("rejects the placeholder %s in %s", (value, field) => {
    const content = makeContent({
      experience: [experience],
      [field]: `  ${value.toUpperCase()} `,
    });

    expect(isIndexableProfile(content, { hide_from_search: false })).toBe(false);
  });

  it("rejects blank names and headlines after trimming", () => {
    expect(
      isIndexableProfile(makeContent({ full_name: "  ", experience: [experience] }), {
        hide_from_search: false,
      }),
    ).toBe(false);
    expect(
      isIndexableProfile(makeContent({ headline: "\t", experience: [experience] }), {
        hide_from_search: false,
      }),
    ).toBe(false);
  });

  it("requires experience or education; summary alone is insufficient", () => {
    expect(isIndexableProfile(makeContent(), { hide_from_search: false })).toBe(false);
    expect(
      isIndexableProfile(makeContent({ summary: "writer ".repeat(100) }), {
        hide_from_search: false,
      }),
    ).toBe(false);
    expect(
      isIndexableProfile(makeContent({ experience: [experience] }), { hide_from_search: false }),
    ).toBe(true);
    expect(
      isIndexableProfile(
        makeContent({ education: [{ degree: "Mathematics", institution: "London University" }] }),
        { hide_from_search: false },
      ),
    ).toBe(true);
  });
});
