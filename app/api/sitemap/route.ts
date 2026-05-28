import { buildSitemapXml, generateSitemapEntries } from "@/lib/seo/sitemap";

/**
 * GET /sitemap.xml
 *
 * Generates the first sitemap shard (shard 0) as an XML response.
 * Each shard contains a subset of user profile URLs to stay within
 * search engine size limits (typically 50,000 URLs per sitemap).
 *
 * XML response format:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 *   <url><loc>https://clickfolio.me/@handle</loc><lastmod>2024-01-01</lastmod></url>
 * </urlset>
 * ```
 *
 * Cache headers: `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`
 */
export async function GET(): Promise<Response> {
  try {
    const entries = await generateSitemapEntries(0);
    const xml = buildSitemapXml(entries);
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[sitemap] Error generating sitemap shard 0:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
