import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DEMO_RESUME_CONTENT } from "@/lib/templates/demo-data";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import { getTemplate } from "@/lib/templates/theme-registry";
import type { ResumeContent } from "@/lib/types/database";

// Every theme must render for whatever the AI parser can produce, not just the polished demo
// resume. The sparse and stress shapes below are valid per lib/schemas/resume.ts.

const SPARSE: ResumeContent = {
  full_name: "Sparse Person",
  headline: "Headline",
  summary: "Summary.",
  contact: { email: "" },
  experience: [],
};

const EMPTY_STRINGS: ResumeContent = {
  full_name: "Blank Fields",
  headline: "Headline",
  summary: "Summary.",
  contact: { email: "", phone: "", location: "", linkedin: "", github: "", website: "" },
  experience: [
    {
      title: "Role",
      company: "Company",
      location: "",
      start_date: "Summer 2020",
      end_date: "",
      description: "",
    },
  ],
  education: [
    { degree: "Degree", institution: "School", location: "", graduation_date: "", gpa: "" },
  ],
  skills: [],
  certifications: [{ name: "Cert", issuer: "", date: "", url: "" }],
  projects: [{ title: "Project", description: "Does a thing.", year: "", url: "", image_url: "" }],
};

const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(8);

const STRESS: ResumeContent = {
  full_name: `Stress ${LONG_WORD}`,
  headline: LONG_WORD,
  summary: `${"Long summary sentence. ".repeat(80)}${LONG_WORD}`,
  contact: {
    email: "stress@example.com",
    phone: "+1 555 0100",
    location: "Reykjavík, Ísland",
    linkedin: "https://linkedin.com/in/stress",
    github: "https://github.com/stress",
    website: "https://stress.example.com",
    behance: "https://behance.net/stress",
    dribbble: "https://dribbble.com/stress",
  },
  experience: Array.from({ length: 10 }, (_, i) => ({
    title: `Role ${i} ${LONG_WORD}`,
    company: `Company ${i}`,
    location: "Remote",
    start_date: `${2010 + i}-0${(i % 9) + 1}`,
    end_date: i === 0 ? undefined : `${2011 + i}-01`,
    description: "Did many things. ".repeat(40),
    highlights: Array.from(
      { length: 8 },
      (_, j) => `Highlight ${j}: grew metric by ${j * 7}% ${LONG_WORD}`,
    ),
  })),
  education: Array.from({ length: 4 }, (_, i) => ({
    degree: `Degree ${i}`,
    institution: `Institution ${i}`,
    graduation_date: `${2000 + i}`,
    gpa: "3.9",
  })),
  skills: Array.from({ length: 12 }, (_, i) => ({
    category: `Category ${i}`,
    items: Array.from({ length: 15 }, (_, j) => `Skill ${i}-${j}`),
  })),
  certifications: Array.from({ length: 6 }, (_, i) => ({
    name: `Certification ${i}`,
    issuer: "Issuer",
    date: "2022-05",
    url: "https://example.com/cert",
  })),
  projects: Array.from({ length: 10 }, (_, i) => ({
    title: `Project ${i} ${LONG_WORD}`,
    description: "Project description. ".repeat(30),
    year: `${2015 + i}`,
    technologies: ["TypeScript", "Rust", LONG_WORD],
    url: "https://example.com/project",
    image_url: i % 2 === 0 ? "https://example.com/shot.png" : "",
  })),
};

const PROFILES = {
  withoutAvatar: { avatar_url: null, handle: "someone" },
  withAvatar: { avatar_url: "https://example.com/avatar.png", handle: "someone" },
} as const;

// Text a visitor must never see because a field was missing.
const LEAKED = /\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/;

async function render(
  themeId: ThemeId,
  content: ResumeContent,
  profile: (typeof PROFILES)[keyof typeof PROFILES],
) {
  const Template = await getTemplate(themeId);
  const html = renderToStaticMarkup(createElement(Template, { content, profile }));

  const visibleText = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");

  return { html, visibleText };
}

describe.each(THEME_IDS)("template %s", (themeId) => {
  it("renders its own demo resume", async () => {
    const content: ResumeContent = DEMO_RESUME_CONTENT[themeId];
    const { html, visibleText } = await render(themeId, content, PROFILES.withoutAvatar);

    expect(html).toContain(content.full_name);
    expect(visibleText).not.toMatch(LEAKED);
  });

  it("renders a resume with only the required fields", async () => {
    const { html, visibleText } = await render(themeId, SPARSE, PROFILES.withoutAvatar);

    expect(html).toContain("Sparse Person");
    expect(visibleText).not.toMatch(LEAKED);
  });

  it("renders optional fields that the parser returned as empty strings", async () => {
    const { html, visibleText } = await render(themeId, EMPTY_STRINGS, PROFILES.withAvatar);

    expect(html).toContain("Blank Fields");
    expect(visibleText).not.toMatch(LEAKED);
  });

  it("renders the maximum number of entries and very long unbroken text", async () => {
    const { html, visibleText } = await render(themeId, STRESS, PROFILES.withAvatar);

    expect(html).toContain("Stress ");
    expect(visibleText).not.toMatch(LEAKED);
  });

  it("does not render raw HTML from resume text", async () => {
    const hostile: ResumeContent = { ...SPARSE, full_name: "Evil <img src=x onerror=alert(1)>" };
    const { html } = await render(themeId, hostile, PROFILES.withoutAvatar);

    expect(html).not.toContain("<img src=x");
  });
});
