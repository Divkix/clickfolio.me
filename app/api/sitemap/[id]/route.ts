import {
  buildSitemapXml,
  generateSitemapEntries,
  getSitemapShardCount,
  getTotalIndexableUserCount,
} from "@/lib/seo/sitemap";

function parseSitemapId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null;

  const parsed = Number.parseInt(rawId, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: rawId } = await params;
    const id = parseSitemapId(rawId);

    if (id === null) {
      return new Response("Invalid sitemap id", { status: 400 });
    }

    const indexableUserCount = await getTotalIndexableUserCount();
    const shardCount = getSitemapShardCount(indexableUserCount);
    if (id >= shardCount) {
      return new Response("Sitemap shard not found", { status: 404 });
    }

    const entries = await generateSitemapEntries(id);
    const xml = buildSitemapXml(entries);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error(`[sitemap] Error generating sitemap shard:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
