import {
  buildSitemapIndexXml,
  getSitemapShardCount,
  getTotalIndexableUserCount,
} from "@/lib/sitemap";

export async function GET(): Promise<Response> {
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
}
