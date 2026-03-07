import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "@/lib/sitemap";

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
