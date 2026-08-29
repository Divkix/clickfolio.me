import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import robots from "@/app/robots";

describe("robots metadata", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("points sitemap to rewritten /sitemap.xml endpoint", () => {
    vi.stubEnv("APP_URL", "https://example.com");

    const config = robots();

    expect(config.sitemap).toBe("https://example.com/sitemap.xml");
  });

  it("explicitly allows AI answer and preview crawlers on public pages", () => {
    const config = robots();

    expect(config.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userAgent: "GPTBot",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
        expect.objectContaining({
          userAgent: "ChatGPT-User",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
        expect.objectContaining({
          userAgent: "ClaudeBot",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
        expect.objectContaining({
          userAgent: "PerplexityBot",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
        expect.objectContaining({
          userAgent: "Google-Extended",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
        expect.objectContaining({
          userAgent: "GoogleOther",
          allow: ["/", "/explore", "/blog"],
          disallow: expect.arrayContaining(["/admin/", "/dashboard/", "/edit/"]),
        }),
      ]),
    );
  });

  it("copies the * Disallow list onto every AI crawler group", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const starRule = rules.find((rule) => rule.userAgent === "*");
    const aiAgents = [
      "GPTBot",
      "ChatGPT-User",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
      "GoogleOther",
    ];

    expect(starRule?.disallow).toEqual([
      "/admin/",
      "/dashboard/",
      "/edit/",
      "/preview/",
      "/settings/",
      "/waiting/",
      "/wizard/",
    ]);

    for (const userAgent of aiAgents) {
      const rule = rules.find((entry) => entry.userAgent === userAgent);
      expect(rule?.disallow).toEqual(starRule?.disallow);
    }
  });
});
