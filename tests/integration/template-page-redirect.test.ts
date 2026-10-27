import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { templatePageHead, themeIdForSlugOrRedirect } from "@/app/routes/templates/$theme";
import { REMOVED_THEME_REPLACEMENTS, THEME_IDS, themeSlug } from "@/lib/templates/theme-ids";

function thrownBySlug(slug: string) {
  try {
    themeIdForSlugOrRedirect(slug);
  } catch (error) {
    return error;
  }

  throw new Error("Expected the theme slug to redirect or be missing");
}

describe("/templates/$theme", () => {
  it("308s every removed theme's slug to its replacement", () => {
    for (const [removed, replacement] of Object.entries(REMOVED_THEME_REPLACEMENTS)) {
      const error = thrownBySlug(removed.replaceAll("_", "-"));
      expect(isRedirect(error)).toBe(true);

      if (!isRedirect(error)) throw error;
      expect(error.status).toBe(308);
      expect(error.options.to).toBe("/templates/$theme");
      expect(error.options.params).toEqual({ theme: themeSlug(replacement) });
    }
  });

  it("404s unknown and non-kebab slugs", () => {
    for (const slug of ["not-a-theme", "sidebar_photo", "case_file"]) {
      expect(isNotFound(thrownBySlug(slug))).toBe(true);
    }
  });

  it("renders an empty head when beforeLoad 404ed and left no themeId", () => {
    expect(templatePageHead(undefined)).toEqual({});
  });

  it("keeps serving current themes and no longer lists removed ones", () => {
    const slugs = THEME_IDS.map(themeSlug);
    expect(themeIdForSlugOrRedirect("case-file")).toBe("case_file");
    expect(slugs).toContain("case-file");

    for (const id of Object.keys(REMOVED_THEME_REPLACEMENTS)) {
      expect(slugs).not.toContain(id.replaceAll("_", "-"));
    }
  });
});
