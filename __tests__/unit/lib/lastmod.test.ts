import { describe, expect, it } from "vite-plus/test";
import { PROFESSIONS } from "@/lib/config/professions";
import { getStaticLastmod, routesForChangedFiles } from "@/lib/seo/lastmod";
import lastmod from "@/lib/seo/lastmod.json";

const PROFESSION_ROUTES = PROFESSIONS.map((profession) => `/for/${profession.slug}`).sort();

describe("lastmod.json", () => {
  it("dates every static sitemap page and profession route", () => {
    for (const route of [
      "/",
      "/privacy",
      "/terms",
      "/about",
      "/faq",
      "/contact",
      ...PROFESSION_ROUTES,
    ]) {
      expect(getStaticLastmod(route), route).toBeInstanceOf(Date);
    }
  });

  it("stores only valid YYYY-MM-DD dates", () => {
    for (const [route, value] of Object.entries(lastmod)) {
      expect(value, route).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(value).getTime()), route).toBe(false);
    }
  });

  it("returns undefined for an untracked route", () => {
    expect(getStaticLastmod("/nope")).toBeUndefined();
  });
});

describe("routesForChangedFiles", () => {
  it("maps a route folder's files to that route", () => {
    expect(routesForChangedFiles(["app/about/page.tsx"])).toEqual(["/about"]);
    expect(routesForChangedFiles(["app/for/designer/page.tsx"])).toEqual(["/for/designer"]);
  });

  it("maps nested files and route groups to the owning tracked route", () => {
    expect(routesForChangedFiles(["app/faq/_parts/list.tsx"])).toEqual(["/faq"]);
    expect(routesForChangedFiles(["app/(marketing)/contact/page.tsx"])).toEqual(["/contact"]);
  });

  it("maps only app/page.tsx to the homepage, not other root app files", () => {
    expect(routesForChangedFiles(["app/page.tsx"])).toEqual(["/"]);
    expect(
      routesForChangedFiles(["app/layout.tsx", "app/globals.css", "app/not-found.tsx"]),
    ).toEqual([]);
  });

  it("maps content sources outside app/ to every route they feed", () => {
    expect(routesForChangedFiles(["components/home/landing/DropFirstLanding.tsx"])).toEqual(["/"]);
    expect(routesForChangedFiles(["components/legal/LegalPage.tsx"])).toEqual([
      "/privacy",
      "/terms",
    ]);
    expect(routesForChangedFiles(["components/role/RoleSection.tsx"])).toEqual(PROFESSION_ROUTES);
    expect(routesForChangedFiles(["lib/config/faq.ts"])).toEqual(["/", "/faq"]);
  });

  it("ignores API routes, dynamic routes, untracked pages, and shared chrome", () => {
    expect(
      routesForChangedFiles([
        "app/api/sitemap-index/route.ts",
        "app/[handle]/page.tsx",
        "app/blog/pdf-resume-to-website/page.tsx",
        "app/explore/page.tsx",
        "components/Footer.tsx",
        "components/ui/button.tsx",
        "lib/seo/sitemap.ts",
      ]),
    ).toEqual([]);
  });

  it("deduplicates and sorts routes across files", () => {
    expect(routesForChangedFiles(["app/terms/page.tsx", "components/legal/LegalPage.tsx"])).toEqual(
      ["/privacy", "/terms"],
    );
  });

  it("only returns routes from the tracked set it is given", () => {
    expect(routesForChangedFiles(["app/about/page.tsx"], ["/faq"])).toEqual([]);
  });
});
