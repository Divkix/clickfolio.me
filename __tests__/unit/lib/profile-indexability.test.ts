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
  summary: "A mathematician and writer.",
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

  it("requires a substantive section: experience, education, or a 200-character summary", () => {
    expect(
      isIndexableProfile(makeContent({ summary: "x".repeat(199) }), { hide_from_search: false }),
    ).toBe(false);
    expect(
      isIndexableProfile(makeContent({ summary: ` ${"x".repeat(200)} ` }), {
        hide_from_search: false,
      }),
    ).toBe(true);
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
