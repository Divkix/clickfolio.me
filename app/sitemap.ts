import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, isNotNull, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";

// Cache sitemap for 6 hours - search engines crawl sitemaps infrequently
// 6hrs = 4 regenerations/day, ~40k reads/day for 10k users (well under D1 free tier)
export const revalidate = 21600;

const URLS_PER_SITEMAP = 50000; // Google's limit

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://webresume.now";
}

/**
 * Generate sitemap IDs based on total user count
 * Each sitemap can hold up to 50,000 URLs
 */
export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Count users with handles (completed onboarding)
    const [result] = await db.select({ count: count() }).from(user).where(isNotNull(user.handle));

    const userCount = result?.count ?? 0;

    // Calculate number of sitemaps needed
    // +1 for static pages sitemap (id: 0)
    const dynamicSitemapCount = Math.ceil(userCount / URLS_PER_SITEMAP) || 1;

    // Return array of sitemap IDs
    // id 0 = static pages + first batch of users
    return Array.from({ length: dynamicSitemapCount }, (_, i) => ({ id: i }));
  } catch (error) {
    console.error("Failed to generate sitemaps:", error);
    // Fallback to single sitemap
    return [{ id: 0 }];
  }
}

/**
 * Generate sitemap content for a specific ID
 * ID 0 includes static pages, all IDs include user handles
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const baseUrl = getBaseUrl();
  const entries: MetadataRoute.Sitemap = [];

  // Static pages only in first sitemap
  if (id === 0) {
    entries.push(
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date("2025-01-01"),
        changeFrequency: "yearly",
        priority: 0.3,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date("2025-01-01"),
        changeFrequency: "yearly",
        priority: 0.3,
      },
    );
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Calculate pagination offset
    const offset = id * URLS_PER_SITEMAP;
    const limit = URLS_PER_SITEMAP;

    // Query users with handles, join siteData for lastModified
    // Only select necessary fields for efficiency
    const users = await db
      .select({
        handle: user.handle,
        userUpdatedAt: user.updatedAt,
        siteUpdatedAt: siteData.updatedAt,
      })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(isNotNull(user.handle))
      .orderBy(user.handle) // Consistent ordering for pagination
      .limit(limit)
      .offset(offset);

    // Add user resume URLs
    for (const u of users) {
      if (!u.handle) continue;

      // Use most recent update date
      const lastMod = u.siteUpdatedAt || u.userUpdatedAt;

      entries.push({
        url: `${baseUrl}/${u.handle}`,
        lastModified: lastMod ? new Date(lastMod) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error(`Failed to generate sitemap ${id}:`, error);
    // Return whatever we have (static pages for id 0, empty for others)
  }

  return entries;
}
