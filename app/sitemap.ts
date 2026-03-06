import type { MetadataRoute } from "next";
import { generateSitemapEntries, generateSitemaps } from "@/lib/sitemap";

export { generateSitemaps };

/**
 * Generate sitemap content for a specific ID
 * ID 0 includes static pages, all IDs include user handles
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  return generateSitemapEntries(Number(await props.id));
}
