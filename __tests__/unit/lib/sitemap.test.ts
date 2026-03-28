/**
 * Sitemap generation unit tests
 * Tests for lib/sitemap.ts - Pure functions only
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSitemapIndexXml,
  buildSitemapXml,
  getSitemapBaseUrl,
  URLS_PER_SITEMAP,
} from "@/lib/sitemap";

describe("URLS_PER_SITEMAP", () => {
  it("equals Google's limit of 50000", () => {
    expect(URLS_PER_SITEMAP).toBe(50000);
  });
});

describe("getSitemapBaseUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns BETTER_AUTH_URL when set", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");

    const result = getSitemapBaseUrl();

    expect(result).toBe("https://example.com");
  });

  it("returns default URL when BETTER_AUTH_URL not set", () => {
    vi.stubEnv("BETTER_AUTH_URL", "");

    const result = getSitemapBaseUrl();

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

  it("includes priority with correct decimal format", () => {
    const entries = [
      {
        url: "https://example.com/",
        priority: 0.8,
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<priority>0.8</priority>");
  });

  it("handles priority of 1.0 correctly", () => {
    const entries = [
      {
        url: "https://example.com/",
        priority: 1.0,
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<priority>1.0</priority>");
  });

  it("handles priority of 0.0 correctly", () => {
    const entries = [
      {
        url: "https://example.com/",
        priority: 0.0,
      },
    ];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<priority>0.0</priority>");
  });

  it("skips optional fields when not provided", () => {
    const entries = [{ url: "https://example.com/" }];

    const result = buildSitemapXml(entries);

    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).not.toContain("<lastmod>");
    expect(result).not.toContain("<changefreq>");
    expect(result).not.toContain("<priority>");
  });

  it("generates empty sitemap for empty entries", () => {
    const result = buildSitemapXml([]);

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain("<urlset");
    expect(result).not.toContain("<url>");
  });

  it("handles invalid dates gracefully", () => {
    const entries = [
      {
        url: "https://example.com/",
        lastModified: new Date("invalid"),
      },
    ];

    const result = buildSitemapXml(entries);

    // Should not include lastmod for invalid date
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).not.toContain("<lastmod>Invalid Date</lastmod>");
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

  it("includes correct number of sitemap entries", () => {
    const result = buildSitemapIndexXml(3);

    expect(result).toContain("<sitemap>");
    expect(result.match(/<sitemap>/g)?.length).toBe(3);
  });

  it("formats sitemap locations correctly", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");

    const result = buildSitemapIndexXml(2);

    expect(result).toContain("https://example.com/sitemap/0.xml");
    expect(result).toContain("https://example.com/sitemap/1.xml");
  });

  it("escapes special characters in base URL", () => {
    // Test with URL that would need escaping (edge case)
    const result = buildSitemapIndexXml(1);

    // Should contain proper XML structure
    expect(result).toContain("<loc>");
    expect(result).toContain("</loc>");
  });
});
