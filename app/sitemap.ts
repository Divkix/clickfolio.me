import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, count, isNotNull, or, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";

/**
 * Filter condition for users who haven't opted out of search indexing.
 * Uses json_extract to check the hide_from_search field in privacySettings.
 * Returns true for users who:
 * - Have hide_from_search = false
 * - Don't have the hide_from_search field (backward compatibility)
 */
const notHiddenFromSearch = or(
  sql`json_extract(${user.privacySettings}, '$.hide_from_search') IS NULL`,
  sql`json_extract(${user.privacySettings}, '$.hide_from_search') = false`,
);

const URLS_PER_SITEMAP = 50000; // Google's limit

function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || "https://clickfolio.me";
}

/**
 * Generate sitemap IDs based on total user count
 * Each sitemap can hold up to 50,000 URLs
 */
export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Count users with handles (completed onboarding) who haven't opted out of search
    const [result] = await db
      .select({ count: count() })
      .from(user)
      .where(and(isNotNull(user.handle), notHiddenFromSearch));

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
      {
        url: `${baseUrl}/explore`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
    );
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Calculate pagination offset
    const offset = id * URLS_PER_SITEMAP;
    const limit = URLS_PER_SITEMAP;

    // Query users with handles who haven't opted out of search, join siteData for lastModified
    // Only select necessary fields for efficiency
    const users = await db
      .select({
        handle: user.handle,
        userUpdatedAt: user.updatedAt,
        siteUpdatedAt: siteData.updatedAt,
      })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(and(isNotNull(user.handle), notHiddenFromSearch))
      .orderBy(user.handle) // Consistent ordering for pagination
      .limit(limit)
      .offset(offset);

    // Add user resume URLs
    for (const u of users) {
      if (!u.handle) continue;

      // Use most recent update date
      const lastMod = u.siteUpdatedAt || u.userUpdatedAt;

      entries.push({
        url: `${baseUrl}/@${u.handle}`,
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
