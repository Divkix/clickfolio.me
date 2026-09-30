import { log } from "@/lib/utils/log";
import {
  buildSitemapIndexXml,
  getSitemapShardCount,
  getTotalIndexableUserCount,
} from "@/lib/seo/sitemap";

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
    log("error", "[sitemap-index] Error generating sitemap index:", { error: String(error) });

    return new Response("Internal Server Error", { status: 500 });
  }
}
