import { describe, expect, it } from "vitest";
import { buildSitemapIndexXml, buildSitemapXml } from "@/lib/sitemap";

describe("sitemap xml builders", () => {
  it("builds sitemap index entries for shard URLs", () => {
    const xml = buildSitemapIndexXml([{ id: 0 }, { id: 1 }], "https://clickfolio.me");

    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/0.xml</loc>");
    expect(xml).toContain("<loc>https://clickfolio.me/sitemap/1.xml</loc>");
  });

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
