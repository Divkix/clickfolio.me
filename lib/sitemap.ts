import { env } from "cloudflare:workers";
import { and, isNotNull, or, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";

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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getSitemapBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || "https://clickfolio.me";
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
    const db = getDb(env.CLICKFOLIO_DB);
    const offset = id * URLS_PER_SITEMAP;

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
      .limit(URLS_PER_SITEMAP)
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
