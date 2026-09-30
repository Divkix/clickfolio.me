import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { buildSitemapIndexXml, buildSitemapXml } from "@/lib/seo/sitemap";
import { getPublicSiteUrl } from "@/lib/utils/site-url";

describe("getPublicSiteUrl (sitemap base)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns APP_URL when set", () => {
    vi.stubEnv("APP_URL", "https://example.com");

    const result = getPublicSiteUrl();

    expect(result).toBe("https://example.com");
  });

  it("returns default URL when APP_URL not set", () => {
    vi.stubEnv("APP_URL", "");

    const result = getPublicSiteUrl();

    expect(result).toBe("https://clickfolio.me");
  });
});

describe("buildSitemapXml", () => {
  it("generates valid XML structure", () => {
    const entries = [
      {
        url: "https://example.com/",
        lastModified: new Date("2026-01-15"),
        changeFrequency: "daily" as const,
        priority: 1.0,
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain("<urlset");
    expect(result).toContain("</urlset>");
    expect(result).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
  });

  it("includes all URLs in the sitemap", () => {
    const entries = [
      { url: "https://example.com/" },
      { url: "https://example.com/about" },
      { url: "https://example.com/contact" },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).toContain("<loc>https://example.com/about</loc>");
    expect(result).toContain("<loc>https://example.com/contact</loc>");
  });

  it("escapes special XML characters in URLs", () => {
    const entries = [{ url: "https://example.com/page?foo=bar&baz=qux" }];

    const result = buildSitemapXml(entries);

    expect(result).toContain("&amp;");
    expect(result).not.toContain("&baz");
  });

  it("formats lastmod as ISO string", () => {
    const entries = [
      {
        url: "https://example.com/",
        lastModified: new Date("2026-01-15T12:00:00.000Z"),
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<lastmod>2026-01-15T12:00:00.000Z</lastmod>");
  });

  it("includes changefreq when provided", () => {
    const entries = [
      {
        url: "https://example.com/",
        changeFrequency: "weekly" as const,
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<changefreq>weekly</changefreq>");
  });

  it("skips optional fields when not provided", () => {
    const entries = [{ url: "https://example.com/" }];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).not.toContain("<lastmod>");
    expect(result).not.toContain("<changefreq>");
    expect(result).not.toContain("<priority>");
  });
});

describe("buildSitemapIndexXml", () => {
  it("generates valid sitemap index structure", () => {
    const result = buildSitemapIndexXml(1);

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain("<sitemapindex");
    expect(result).toContain("</sitemapindex>");
    expect(result).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
  });

  it("formats sitemap locations correctly", () => {
    vi.stubEnv("APP_URL", "https://example.com");

    const result = buildSitemapIndexXml(2);

    expect(result).toContain("https://example.com/sitemap/0.xml");
    expect(result).toContain("https://example.com/sitemap/1.xml");
  });
});
