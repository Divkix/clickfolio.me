import { describe, expect, it } from "vite-plus/test";
import { DEMO_RESUME_CONTENT, DEMO_PROFILES } from "@/lib/templates/demo-data";
import type { ResumeContent } from "@/lib/types/database";

const URL_FIELDS = ["linkedin", "github", "website", "behance", "dribbble"] as const;
const URL_FIELDS_IN_SECTIONS = ["url", "image_url"] as const;

/**
 * Recursively collect every URL-looking value (any string that resembles a
 * web URL — contains a dot and no spaces) from a resume content object.
 */
function collectUrls(content: ResumeContent): string[] {
  const urls: string[] = [];

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      // URL-like: contains a letter and a dot, no spaces (bare domains/paths).
      // Exclusions: emails (@) are contact data; pure numbers like GPA "3.9"
      // and framework names like "Next.js"/"D3.js" (dot-prefixed extension with
      // a capital letter or two-letter suffix) are not URLs.
      if (
        !value.includes("@") &&
        !value.includes(" ") &&
        value.includes(".") &&
        /[a-zA-Z]/.test(value) &&
        !/^[A-Za-z0-9]+\.(js|ts|json|md|py)$/.test(value)
      ) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        visit((value as Record<string, unknown>)[key]);
      }
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
      for (const field of URL_FIELDS) {
        const value = content.contact?.[field];
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
          for (const field of URL_FIELDS_IN_SECTIONS) {
            const value = (entry as Record<string, unknown> | undefined)?.[field];
            if (typeof value === "string" && value) {
              expect(
                value.startsWith("https://"),
                `${themeId} ${section}.${field} should start with https:// (got "${value}")`,
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
