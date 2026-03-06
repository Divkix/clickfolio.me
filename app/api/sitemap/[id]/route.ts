import { buildSitemapXml, generateSitemapEntries } from "@/lib/sitemap";

function parseSitemapId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null;

  const parsed = Number.parseInt(rawId, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
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
}
