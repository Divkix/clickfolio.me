import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { REMOVED_THEME_REPLACEMENTS, themeSlug } from "@/lib/templates/theme-ids";

const { notFound, permanentRedirect } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound, permanentRedirect }));

const params = (theme: string) => ({ params: Promise.resolve({ theme }) });

const REMOVED_SLUGS = Object.keys(REMOVED_THEME_REPLACEMENTS).map((id) => id.replaceAll("_", "-"));

beforeEach(() => {
  notFound.mockClear();
  permanentRedirect.mockClear();
});

describe("/templates/[theme]", () => {
  it("308s a removed theme's slug to its replacement", async () => {
    const { generateMetadata, default: ThemePage } = await import("@/app/templates/[theme]/page");

    await expect(generateMetadata(params("sidebar-photo"))).rejects.toThrow(
      "NEXT_REDIRECT /templates/bold-corporate",
    );
    await expect(ThemePage(params("consulting-brief"))).rejects.toThrow(
      "NEXT_REDIRECT /templates/classic-ats",
    );
  });

  it("404s unknown and non-kebab slugs", async () => {
    const { generateMetadata } = await import("@/app/templates/[theme]/page");

    await expect(generateMetadata(params("not-a-theme"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(params("sidebar_photo"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata(params("case_file"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("keeps serving current themes and no longer lists removed ones", async () => {
    const { generateMetadata, generateStaticParams } = await import("@/app/templates/[theme]/page");

    const metadata = await generateMetadata(params("case-file"));
    const slugs = generateStaticParams().map(({ theme }) => theme);

    expect(metadata.alternates?.canonical).toMatch(/\/templates\/case-file$/);
    expect(slugs).toContain(themeSlug("case_file"));

    for (const slug of REMOVED_SLUGS) {
      expect(slugs).not.toContain(slug);
    }
  });
});
