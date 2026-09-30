import { describe, expect, it } from "vite-plus/test";
import { cleanLinkedInText, detectResumeSource, LINKEDIN_PROMPT_RULES } from "@/lib/ai/linkedin";

// Synthetic text in the shape unpdf extracts from a LinkedIn "Save to PDF" export: sidebar first,
// labelled contact links, a company grouping several roles, a page footer landing mid-bullet list,
// a certification without issuer, and a role without a description.
const LINKEDIN_EXPORT_TEXT = `Contact
sam@example.com
www.linkedin.com/in/samrivera
(LinkedIn)
samrivera.dev (Portfolio)
github.com/samrivera (Personal)
Top Skills
TypeScript
Distributed Systems
Certifications
Regional Hackathon Winner
2024
Sam Rivera
Backend Engineer at Example Corp
Denver, Colorado, United States
Summary
I build APIs. My stack: TypeScript, Go, Postgres.
Experience
Example Corp
Backend Engineer
March 2024 - Present (1 year 7 months)
- Designed the billing service
Page 1 of 2
- Cut p99 latency by 40%
State University
3 years 2 months
Teaching Assistant
August 2021 - May 2023 (1 year 10 months)
Research Assistant
June 2020 - July 2021 (1 year 2 months)
Education
State University
Bachelor of Science - BS, Computer Science · (2019 - 2023)
Page 2 of 2`;

const GENERIC_RESUME_TEXT = `Sam Rivera
sam@example.com | linkedin.com/in/samrivera
Experience
Backend Engineer, Example Corp, 2024 - Present
Page 1 of 2`;

describe("detectResumeSource", () => {
  it("detects LinkedIn exports from PDF metadata", () => {
    expect(
      detectResumeSource("", { author: "LinkedIn", subject: "Resume generated from profile" }),
    ).toBe("linkedin");
  });

  it("detects LinkedIn exports from text when metadata is missing", () => {
    expect(detectResumeSource(LINKEDIN_EXPORT_TEXT)).toBe("linkedin");
  });

  it("treats resumes that only mention a LinkedIn URL as generic", () => {
    expect(detectResumeSource(GENERIC_RESUME_TEXT)).toBe("generic");
    expect(detectResumeSource(GENERIC_RESUME_TEXT, { author: "Sam Rivera" })).toBe("generic");
  });

  it("requires both LinkedIn metadata fields", () => {
    expect(detectResumeSource("", { author: "LinkedIn" })).toBe("generic");
  });
});

describe("cleanLinkedInText", () => {
  const cleaned = cleanLinkedInText(LINKEDIN_EXPORT_TEXT);

  it("removes page footers so bullet lists stay contiguous", () => {
    expect(cleaned).not.toMatch(/Page \d+ of \d+/);
    expect(cleaned).toContain("- Designed the billing service\n- Cut p99 latency by 40%");
  });

  it("turns trailing contact labels into prefixes", () => {
    expect(cleaned).toContain("LinkedIn: www.linkedin.com/in/samrivera\n");
    expect(cleaned).toContain("Portfolio: samrivera.dev\n");
    expect(cleaned).toContain("Personal: github.com/samrivera\n");
    expect(cleaned).not.toContain("(LinkedIn)");
  });

  it("leaves the rest of the profile untouched", () => {
    expect(cleaned).toContain("sam@example.com\n");
    expect(cleaned).toContain("State University\n3 years 2 months\nTeaching Assistant");
    expect(cleaned).toContain("Bachelor of Science - BS, Computer Science · (2019 - 2023)");
  });
});

describe("LINKEDIN_PROMPT_RULES", () => {
  it("tells the model not to invent issuers or descriptions", () => {
    expect(LINKEDIN_PROMPT_RULES).toContain("never guess it");
    expect(LINKEDIN_PROMPT_RULES).toContain("Leave description as an empty string");
  });
});
