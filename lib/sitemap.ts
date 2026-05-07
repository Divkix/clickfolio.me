import { env } from "cloudflare:workers";
import { and, isNotNull, or, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { getPublicSiteUrl } from "@/lib/utils/site-url";
import { escapeXml } from "@/lib/utils/xml";

const SITEMAP_XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9";

/**
 * Filter condition for users who haven't opted out of search indexing.
 * Uses json_extract to check the hide_from_search field in privacySettings.
 */
const notHiddenFromSearch = or(
  sql`json_extract(${user.privacySettings}, '$.hide_from_search') IS NULL`,
  sql`json_extract(${user.privacySettings}, '$.hide_from_search') = false`,
);

export const URLS_PER_SITEMAP = 50000; // Google's limit
const BASE_STATIC_SITEMAP_ENTRY_COUNT = 5;
const PROFESSION_PAGE_SLUGS = [
  "software-engineer",
  "designer",
  "marketer",
  "student",
  "consultant",
  "product-manager",
];
export const STATIC_SITEMAP_ENTRY_COUNT =
  BASE_STATIC_SITEMAP_ENTRY_COUNT + PROFESSION_PAGE_SLUGS.length + BLOG_POSTS.length;

export function getSitemapBaseUrl(): string {
  return getPublicSiteUrl();
}

export function getSitemapShardCount(indexableUserCount: number): number {
  const safeUserCount = Math.max(0, indexableUserCount);
  return Math.max(1, Math.ceil((STATIC_SITEMAP_ENTRY_COUNT + safeUserCount) / URLS_PER_SITEMAP));
}

function getUserShardWindow(id: number): { limit: number; offset: number } {
  const firstShardUserLimit = Math.max(0, URLS_PER_SITEMAP - STATIC_SITEMAP_ENTRY_COUNT);

  if (id === 0) {
    return { limit: firstShardUserLimit, offset: 0 };
  }

  return {
    limit: URLS_PER_SITEMAP,
    offset: firstShardUserLimit + (id - 1) * URLS_PER_SITEMAP,
  };
}

function buildStaticSitemapEntries(baseUrl: string): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-02-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2025-12-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  for (const profession of PROFESSION_PAGE_SLUGS) {
    entries.push({
      url: `${baseUrl}/for/${profession}`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const post of BLOG_POSTS) {
    entries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}

/**
 * Build sitemap entries for a specific shard ID.
 * ID 0 includes static pages; all IDs include public handles.
 */
export async function generateSitemapEntries(id: number): Promise<MetadataRoute.Sitemap> {
  if (!Number.isInteger(id) || id < 0) {
    return [];
  }

  const baseUrl = getSitemapBaseUrl();
  const entries: MetadataRoute.Sitemap = [];

  if (id === 0) {
    entries.push(...buildStaticSitemapEntries(baseUrl));
  }

  try {
    const db = getDb(env.CLICKFOLIO_DB);
    const { limit, offset } = getUserShardWindow(id);

    const users = await db
      .select({
        handle: user.handle,
        userUpdatedAt: user.updatedAt,
        siteUpdatedAt: siteData.updatedAt,
      })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(and(isNotNull(user.handle), notHiddenFromSearch))
      .orderBy(user.handle)
      .limit(limit)
      .offset(offset);

    for (const entry of users) {
      if (!entry.handle) continue;

      const lastModified = entry.siteUpdatedAt || entry.userUpdatedAt;

      entries.push({
        url: `${baseUrl}/@${entry.handle}`,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error(`Failed to generate sitemap ${id}:`, error);
  }

  return entries;
}

/**
 * Count total indexable users (have a handle, not hidden from search).
 */
export async function getTotalIndexableUserCount(): Promise<number> {
  const db = getDb(env.CLICKFOLIO_DB);
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(and(isNotNull(user.handle), notHiddenFromSearch));
  return result[0]?.count ?? 0;
}

/**
 * Build a sitemap index XML string for the given number of shards.
 */
export function buildSitemapIndexXml(shardCount: number): string {
  const baseUrl = getSitemapBaseUrl();
  const sitemaps = Array.from({ length: shardCount }, (_, i) =>
    [
      `  <sitemap>`,
      `    <loc>${escapeXml(`${baseUrl}/sitemap/${i}.xml`)}</loc>`,
      `  </sitemap>`,
    ].join("\n"),
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="${SITEMAP_XMLNS}">
${sitemaps}
</sitemapindex>`;
}

function formatLastModified(
  lastModified: MetadataRoute.Sitemap[number]["lastModified"],
): string | null {
  if (!lastModified) return null;
  const date = lastModified instanceof Date ? lastModified : new Date(lastModified);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildSitemapXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries
    .map((entry) => {
      const lastModified = formatLastModified(entry.lastModified);
      const parts = ["  <url>", `    <loc>${escapeXml(entry.url)}</loc>`];

      if (lastModified) {
        parts.push(`    <lastmod>${escapeXml(lastModified)}</lastmod>`);
      }
      if (entry.changeFrequency) {
        parts.push(`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`);
      }
      if (typeof entry.priority === "number") {
        parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      }

      parts.push("  </url>");
      return parts.join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${SITEMAP_XMLNS}">
${urls}
</urlset>`;
}
