import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { DEMO_RESUME_CONTENT, DEMO_PROFILES } from "@/lib/templates/demo-data";
import type { JsonValue } from "@/lib/types/json";
import type { ResumeContent } from "@/lib/types/database";

const URL_FIELDS = ["linkedin", "github", "website", "behance", "dribbble"] as const;

// Domain schema for the recursive walk: each JsonValue branch decodes through
// zod instead of narrowing a representation at runtime.
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function collectUrls(content: ResumeContent): string[] {
  const urls: string[] = [];

  const visit = (value: JsonValue): void => {
    const items = z.array(jsonValueSchema).safeParse(value);

    if (items.success) {
      for (const item of items.data) visit(item);

      return;
    }

    const text = z.string().safeParse(value);

    if (text.success) {
      const candidate = text.data;

      if (
        !candidate.includes("@") &&
        !candidate.includes(" ") &&
        candidate.includes(".") &&
        /[a-zA-Z]/.test(candidate) &&
        !/^[A-Za-z0-9]+\.(js|ts|json|md|py)$/.test(candidate)
      ) {
        urls.push(candidate);
      }

      return;
    }

    const record = z.record(z.string(), jsonValueSchema).safeParse(value);

    if (record.success) {
      for (const item of Object.values(record.data)) visit(item);
    }
  };

  visit(content);

  return urls;
}

describe("DEMO_RESUME_CONTENT URL audit", () => {
  it("covers every theme id in DEMO_PROFILES", () => {
    for (const profile of DEMO_PROFILES) {
      expect(DEMO_RESUME_CONTENT[profile.id]).toBeDefined();
    }
  });

  it("every contact URL field starts with https://", () => {
    for (const [themeId, content] of Object.entries(DEMO_RESUME_CONTENT)) {
      const contact = z.record(z.string(), z.string()).safeParse(content.contact);

      for (const field of URL_FIELDS) {
        const value = contact.success ? contact.data[field] : undefined;

        if (value) {
          expect(
            value.startsWith("https://"),
            `${themeId} contact.${field} should start with https:// (got "${value}")`,
          ).toBe(true);
        }
      }
    }
  });

  it("every project/certification url and image_url starts with https://", () => {
    for (const [themeId, content] of Object.entries(DEMO_RESUME_CONTENT)) {
      for (const section of ["projects", "certifications"] as const) {
        for (const entry of content[section] ?? []) {
          const urls = [
            { field: "url", parsed: z.string().safeParse("url" in entry ? entry.url : undefined) },
            {
              field: "image_url",
              parsed: z.string().safeParse("image_url" in entry ? entry.image_url : undefined),
            },
          ];

          for (const { field, parsed } of urls) {
            if (parsed.success && parsed.data) {
              expect(
                parsed.data.startsWith("https://"),
                `${themeId} ${section}.${field} should start with https:// (got "${parsed.data}")`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it("contains no protocol-less URLs anywhere in the demo content", () => {
    for (const [themeId, content] of Object.entries(DEMO_RESUME_CONTENT)) {
      for (const url of collectUrls(content)) {
        expect(
          url.startsWith("https://"),
          `${themeId} contains a protocol-less URL-like value: "${url}"`,
        ).toBe(true);
      }
    }
  });
});
