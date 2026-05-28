import {
  buildSitemapIndexXml,
  getSitemapShardCount,
  getTotalIndexableUserCount,
} from "@/lib/seo/sitemap";

/**
 * GET /sitemap-index.xml
 *
 * Generates a sitemap index XML file that points to all sitemap shards.
 * The shard count is calculated from the total number of indexable users
 * divided by the maximum entries per shard.
 *
 * XML response format:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 *   <sitemap><loc>https://clickfolio.me/sitemap/0.xml</loc></sitemap>
 * </sitemapindex>
 * ```
 *
 * Cache headers: `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`
 * `CDN-Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
 */
export async function GET(): Promise<Response> {
  try {
    const count = await getTotalIndexableUserCount();
    const shardCount = getSitemapShardCount(count);
    const xml = buildSitemapIndexXml(shardCount);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[sitemap-index] Error generating sitemap index:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
