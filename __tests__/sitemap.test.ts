import { describe, expect, it } from "vitest";
import { buildSitemapIndexXml, buildSitemapXml } from "@/lib/sitemap";

describe("sitemap xml builders", () => {
  it("builds sitemap xml for url entries", () => {
    const xml = buildSitemapXml([
      {
        url: "https://clickfolio.me/@jane",
        lastModified: new Date("2026-03-01T12:00:00.000Z"),
        changeFrequency: "weekly",
        priority: 0.8,
      },
    ]);

    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://clickfolio.me/@jane</loc>");
    expect(xml).toContain("<lastmod>2026-03-01T12:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });
});

describe("sitemap index xml builder", () => {
  it("builds sitemap index with a single shard", () => {
    const xml = buildSitemapIndexXml(1);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/0.xml</loc>");
    expect(xml).not.toContain("/sitemap/1.xml");
  });

  it("builds sitemap index with multiple shards", () => {
    const xml = buildSitemapIndexXml(3);

    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/0.xml</loc>");
    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/1.xml</loc>");
    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/2.xml</loc>");
    expect(xml).not.toContain("/sitemap/3.xml");
  });

  it("uses /sitemap/:id.xml format matching next.config rewrites", () => {
    const xml = buildSitemapIndexXml(1);
    const match = xml.match(/<loc>([^<]+)<\/loc>/);

    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/\/sitemap\/\d+\.xml$/);
  });
});
