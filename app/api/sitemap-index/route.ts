import { generateSitemaps } from "../../sitemap";

const BASE_URL = process.env.BETTER_AUTH_URL || "https://webresume.now";

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    ({ id }) => `  <sitemap>
    <loc>${BASE_URL}/sitemap/${id}.xml</loc>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
