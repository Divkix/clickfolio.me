import { buildSitemapIndexXml, generateSitemaps } from "@/lib/sitemap";

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();
  const xml = buildSitemapIndexXml(sitemaps);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
