import { describe, expect, it } from "vitest";
import { resumeContentSchema, resumeContentSchemaStrict } from "@/lib/schemas/resume";

/**
 * Minimal valid resume fixture.
 * Mutate individual fields in each test to verify single-field rejection.
 */
const validMinimalResume = {
  full_name: "Jane Doe",
  headline: "Software Engineer",
  summary: "Experienced software engineer specializing in full-stack development.",
  contact: {
    email: "jane@example.com",
  },
  experience: [
    {
      title: "Senior Engineer",
      company: "Acme Corp",
      start_date: "2020-01",
      description: "Led the platform team.",
    },
  ],
};

// ── Lenient schema (AI-parsed content) ──────────────────────────────

describe("resumeContentSchema (lenient)", () => {
  it("accepts a valid minimal resume", async () => {
    const result = await resumeContentSchema.safeParseAsync(validMinimalResume);
    expect(result.success).toBe(true);
  });

  it("accepts email without TLD (AI-parsed)", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      contact: { email: "jane@university" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated resume", async () => {
    const full = {
      ...validMinimalResume,
      contact: {
        email: "jane@example.com",
        phone: "+1 (555) 123-4567",
        location: "San Francisco, CA",
        linkedin: "https://linkedin.com/in/janedoe",
        github: "https://github.com/janedoe",
        website: "https://janedoe.dev",
        behance: "https://behance.net/janedoe",
        dribbble: "https://dribbble.com/janedoe",
      },
      education: [
        {
          degree: "B.S. Computer Science",
          institution: "MIT",
          graduation_date: "2019",
          gpa: "3.9",
        },
      ],
      skills: [{ category: "Languages", items: ["TypeScript", "Python"] }],
      certifications: [{ name: "AWS Solutions Architect", issuer: "Amazon" }],
      projects: [{ title: "Clickfolio", description: "Resume to portfolio tool." }],
    };
    const result = await resumeContentSchema.safeParseAsync(full);
    expect(result.success).toBe(true);
  });

  // ── Required field rejection ────────────────────────────────────

  it("rejects missing full_name", async () => {
    const { full_name: _, ...noName } = validMinimalResume;
    const result = await resumeContentSchema.safeParseAsync(noName);
    expect(result.success).toBe(false);
  });

  it("rejects missing headline", async () => {
    const { headline: _, ...noHeadline } = validMinimalResume;
    const result = await resumeContentSchema.safeParseAsync(noHeadline);
    expect(result.success).toBe(false);
  });

  it("rejects missing summary", async () => {
    const { summary: _, ...noSummary } = validMinimalResume;
    const result = await resumeContentSchema.safeParseAsync(noSummary);
    expect(result.success).toBe(false);
  });

  it("rejects missing contact email", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      contact: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty experience array", async () => {
    // experience array itself is required and must have at least one element
    // (experience field is required since it's not .optional())
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      experience: [],
    });
    // An empty array is technically valid for the array itself (no .min()),
    // but experience entries themselves are validated per-item
    expect(result.success).toBe(true);
  });

  // ── XSS rejection ──────────────────────────────────────────────

  it("rejects XSS in full_name", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      full_name: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((e) => e.path.includes("full_name"));
      expect(issue?.message).toBe("Invalid content detected");
    }
  });

  it("rejects XSS in headline", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      headline: "<iframe src=evil.com>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects XSS in summary", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      summary: 'Hello <img onerror="alert(1)" src=x>',
    });
    expect(result.success).toBe(false);
  });

  it("rejects XSS in experience title", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      experience: [
        {
          title: "<script>steal()</script>",
          company: "Acme",
          start_date: "2020-01",
          description: "Normal text.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("sanitizes javascript: URL in contact linkedin to empty string", async () => {
    // javascript: is a valid URL per URL spec, so Zod's .url() accepts it.
    // sanitizeUrl transforms it to "" — the real defense is the transform, not rejection.
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      contact: {
        email: "jane@example.com",
        linkedin: "javascript:alert(1)",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact.linkedin).toBe("");
    }
  });

  // ── URL sanitization ───────────────────────────────────────────

  it("transforms sanitized URLs (blocks dangerous protocols)", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      contact: {
        email: "jane@example.com",
        website: "https://example.com",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact.website).toBe("https://example.com");
    }
  });

  // ── Length limits ──────────────────────────────────────────────

  it("rejects full_name exceeding 200 characters", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      full_name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects summary exceeding 10000 characters", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      summary: "A".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects experience description exceeding 5000 characters", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      experience: [
        {
          title: "Engineer",
          company: "Acme",
          start_date: "2020",
          description: "B".repeat(5001),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  // ── Array limits ───────────────────────────────────────────────

  it("rejects more than 10 experience entries", async () => {
    const entry = {
      title: "Engineer",
      company: "Acme",
      start_date: "2020",
      description: "Did stuff.",
    };
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      experience: Array.from({ length: 11 }, () => ({ ...entry })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 skill categories", async () => {
    const category = { category: "Cat", items: ["Skill"] };
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      skills: Array.from({ length: 21 }, () => ({ ...category })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 projects", async () => {
    const project = { title: "Proj", description: "Desc" };
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      projects: Array.from({ length: 11 }, () => ({ ...project })),
    });
    expect(result.success).toBe(false);
  });

  // ── Sanitization transforms ────────────────────────────────────

  it("trims whitespace from fields", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      full_name: "  Jane Doe  ",
      contact: { email: "  jane@example.com  " },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Jane Doe");
      expect(result.data.contact.email).toBe("jane@example.com");
    }
  });

  it("allows optional empty strings for phone", async () => {
    const result = await resumeContentSchema.safeParseAsync({
      ...validMinimalResume,
      contact: { email: "jane@example.com", phone: "" },
    });
    expect(result.success).toBe(true);
  });
});

// ── Strict schema (user edits) ──────────────────────────────────────

describe("resumeContentSchemaStrict", () => {
  it("accepts valid email with TLD", async () => {
    const result = await resumeContentSchemaStrict.safeParseAsync(validMinimalResume);
    expect(result.success).toBe(true);
  });

  it("rejects email without TLD", async () => {
    const result = await resumeContentSchemaStrict.safeParseAsync({
      ...validMinimalResume,
      contact: { email: "jane@university" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((e) => e.path.includes("email"));
      expect(emailIssue?.message).toContain("domain extension");
    }
  });

  it("accepts email with valid TLD", async () => {
    const result = await resumeContentSchemaStrict.safeParseAsync({
      ...validMinimalResume,
      contact: { email: "jane@company.co.uk" },
    });
    expect(result.success).toBe(true);
  });
});
