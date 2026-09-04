import { env } from "cloudflare:workers";
import { and, isNotNull, or, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { z } from "zod";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { getPublicSiteUrl } from "@/lib/utils/site-url";
import { escapeXml } from "@/lib/utils/xml";
const SITEMAP_XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9";

const notHiddenFromSearch = or(
  sql`${user.privacySettings}->>'hide_from_search' IS NULL`,
  sql`${user.privacySettings}->>'hide_from_search' = 'false'`,
);

export const URLS_PER_SITEMAP = 50000;
const BASE_STATIC_SITEMAP_ENTRY_COUNT = 7;

export const STATIC_SITEMAP_ENTRY_COUNT =
  BASE_STATIC_SITEMAP_ENTRY_COUNT + PROFESSIONS.length + BLOG_POSTS.length;

export function getSitemapShardCount(indexableUserCount: number): number {
  const safeUserCount = Math.max(0, indexableUserCount);
  return Math.max(1, Math.ceil((STATIC_SITEMAP_ENTRY_COUNT + safeUserCount) / URLS_PER_SITEMAP));
}

type UserShardWindow = { limit: number; offset: number };

function getUserShardWindow(id: number): UserShardWindow {
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
    {
      url: `${baseUrl}/about`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  for (const profession of PROFESSIONS) {
    entries.push({
      url: `${baseUrl}/for/${profession.slug}`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const post of BLOG_POSTS) {
    entries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.dateModified ?? post.date),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}

export async function generateSitemapEntries(id: number): Promise<MetadataRoute.Sitemap> {
  if (!Number.isInteger(id) || id < 0) {
    return [];
  }

  const baseUrl = getPublicSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  if (id === 0) {
    entries.push(...buildStaticSitemapEntries(baseUrl));
  }

  try {
    const db = getDb(env.HYPERDRIVE);
    const { limit, offset } = getUserShardWindow(id);

    const users = await db
      .select({
        handle: user.handle,
        userUpdatedAt: user.updatedAt,
        siteUpdatedAt: siteData.updatedAt,
        lastPublishedAt: siteData.lastPublishedAt,
      })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(and(isNotNull(user.handle), notHiddenFromSearch))
      .orderBy(user.handle)
      .limit(limit)
      .offset(offset);

    for (const entry of users) {
      if (!entry.handle) continue;

      const lastModified = entry.lastPublishedAt || entry.siteUpdatedAt || entry.userUpdatedAt;

      const publishDate = entry.lastPublishedAt ? new Date(entry.lastPublishedAt) : null;
      const isRecent = publishDate && Date.now() - publishDate.getTime() < 7 * 24 * 60 * 60 * 1000;

      entries.push({
        url: `${baseUrl}/@${entry.handle}`,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
        changeFrequency: isRecent ? "daily" : "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error(`Failed to generate sitemap ${id}:`, error);
  }

  return entries;
}

export async function getTotalIndexableUserCount(): Promise<number> {
  const db = getDb(env.HYPERDRIVE);
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(and(isNotNull(user.handle), notHiddenFromSearch));
  return result[0]?.count ?? 0;
}

export function buildSitemapIndexXml(shardCount: number): string {
  const baseUrl = getPublicSiteUrl();
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
      if (z.number().safeParse(entry.priority).success) {
        // SAFETY: sitemap URL priority is from validated sitemap entries, zod safeParse above guarantees it is number.
        parts.push(`    <priority>${(entry.priority as number).toFixed(1)}</priority>`);
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
