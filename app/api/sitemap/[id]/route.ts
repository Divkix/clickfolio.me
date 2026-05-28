import { buildSitemapXml, generateSitemapEntries } from "@/lib/seo/sitemap";

/**
 * Parses a raw sitemap shard ID string into a safe integer.
 *
 * @param rawId - The raw ID string from the URL parameter.
 * @returns The parsed integer if valid, otherwise `null`.
 */
function parseSitemapId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null;

  const parsed = Number.parseInt(rawId, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * GET /sitemap/[id].xml
 *
 * Generates a specific sitemap shard as an XML response.
 * The `id` parameter is a 0-based shard index used for paginating
 * sitemap entries across multiple files.
 *
 * @param _request - The incoming request (intentionally ignored, vinext pattern).
 * @param params - Route parameters containing the shard `id`.
 *
 * @returns XML sitemap with `Content-Type: application/xml`.
 * Returns 400 for an invalid `id` (non-numeric or out of safe integer range).
 *
 * Cache headers: `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`
 * `CDN-Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
 */
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
