import { describe, expect, it } from "vite-plus/test";
import { resumeContentSchema, resumeContentSchemaStrict } from "@/lib/schemas/resume";

const VALID_RESUME = {
  full_name: "Jane Smith",
  headline: "Software Engineer",
  summary: "Builds useful software.",
  contact: { email: "jane@example.com" },
  experience: [
    {
      title: "Engineer",
      company: "Example",
      start_date: "2020-01",
      description: "Built useful software.",
    },
  ],
};

const URL_PATHS = [
  ["contact", "linkedin"],
  ["contact", "github"],
  ["contact", "website"],
  ["contact", "behance"],
  ["contact", "dribbble"],
  ["certifications", 0, "url"],
  ["projects", 0, "url"],
  ["projects", 0, "image_url"],
];

function resumeWithUrls(value: string | undefined) {
  return {
    ...VALID_RESUME,
    contact: {
      ...VALID_RESUME.contact,
      linkedin: value,
      github: value,
      website: value,
      behance: value,
      dribbble: value,
    },
    certifications: [{ name: "Certification", issuer: "Example", url: value }],
    projects: [
      {
        title: "Portfolio",
        description: "A portfolio website.",
        url: value,
        image_url: value,
      },
    ],
  };
}

const URL_PREFIX = "https://example.com/";
const MAX_LENGTH_URL = URL_PREFIX + "a".repeat(500 - URL_PREFIX.length);

for (const { name, schema } of [
  { name: "parsed resumes", schema: resumeContentSchema },
  { name: "edited resumes", schema: resumeContentSchemaStrict },
]) {
  describe(`resume validation for ${name}`, () => {
    it.each([
      ["HTTPS URLs", "https://example.com/profile"],
      ["HTTP URLs", "http://example.com/profile"],
      ["trimmed URLs", "  https://example.com/profile  "],
      ["500-character URLs", MAX_LENGTH_URL],
      ["empty URLs", ""],
      ["omitted URLs", undefined],
    ])("accepts %s", (_label, value) => {
      expect(schema.safeParse(resumeWithUrls(value)).success).toBe(true);
    });

    it.each([
      ["malformed URLs", "not a URL"],
      ["overlong malformed URLs", "A".repeat(501)],
    ])("explains %s without an empty-string error", (_label, value) => {
      const result = schema.safeParse(resumeWithUrls(value));

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.issues).toEqual(
        expect.arrayContaining(
          URL_PATHS.map((path) =>
            expect.objectContaining({
              path,
              message: "Enter a full URL starting with https:// or http://",
            }),
          ),
        ),
      );

      for (const issue of result.error.issues) {
        expect(issue.message).not.toContain("empty string");
        expect(issue.message).not.toContain(value);
        expect(issue.message.length).toBeLessThan(100);
      }
    });

    it("keeps the 500-character limit for every profile URL", () => {
      const result = schema.safeParse(resumeWithUrls(`${MAX_LENGTH_URL}a`));

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.issues.map(({ path }) => path)).toEqual(URL_PATHS);

      for (const issue of result.error.issues) {
        expect(issue.message).toContain("max 500 characters");
      }
    });

    it.each(["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"])(
      "rejects hostile list content at its item paths: %s",
      (value) => {
        const result = schema.safeParse({
          ...VALID_RESUME,
          experience: [{ ...VALID_RESUME.experience[0], highlights: ["Shipped a product", value] }],
          skills: [{ category: "Languages", items: ["TypeScript", value] }],
        });

        expect(result.success).toBe(false);

        if (result.success) return;

        expect(result.error.issues.map(({ path, message }) => ({ path, message }))).toEqual([
          {
            path: ["experience", 0, "highlights", 1],
            message: "Use plain text without scripts or event handlers",
          },
          {
            path: ["skills", 0, "items", 1],
            message: "Use plain text without scripts or event handlers",
          },
        ]);
      },
    );

    it("accepts ordinary punctuation in achievements and skills", () => {
      expect(
        schema.safeParse({
          ...VALID_RESUME,
          experience: [
            {
              ...VALID_RESUME.experience[0],
              highlights: ["Improved throughput > 25% & reduced latency < 1 ms"],
            },
          ],
          skills: [{ category: "Languages", items: ["C++", "C#", "R&D"] }],
        }).success,
      ).toBe(true);
    });

    it("explains oversized achievements without a technical schema error", () => {
      const result = schema.safeParse({
        ...VALID_RESUME,
        experience: [{ ...VALID_RESUME.experience[0], highlights: ["A".repeat(501)] }],
      });

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.issues).toMatchObject([
        {
          path: ["experience", 0, "highlights", 0],
          message: "Achievement is too long (max 500 characters)",
        },
      ]);
    });

    it("keeps oversized email errors concise and excludes the input", () => {
      const email = "A".repeat(10000);
      const result = schema.safeParse({ ...VALID_RESUME, contact: { email } });

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["contact", "email"], message: "Email is too long" }),
        ]),
      );

      for (const issue of result.error.issues) {
        expect(issue.path).toEqual(["contact", "email"]);
        expect(issue.message.length).toBeLessThan(100);
        expect(issue.message).not.toContain(email);
        expect(issue.message).not.toContain("empty string");
      }
    });
  });
}

it("keeps an absent or empty parsed email optional", () => {
  expect(resumeContentSchema.safeParse({ ...VALID_RESUME, contact: {} }).success).toBe(true);
  expect(resumeContentSchema.safeParse({ ...VALID_RESUME, contact: { email: "" } }).success).toBe(
    true,
  );
});
