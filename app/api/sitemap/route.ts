import { buildSitemapXml, generateSitemapEntries } from "@/lib/sitemap";

export async function GET(): Promise<Response> {
  const entries = await generateSitemapEntries(0);
  const xml = buildSitemapXml(entries);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
