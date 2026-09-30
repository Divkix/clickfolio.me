import { log } from "@/lib/utils/log";
import { env } from "cloudflare:workers";
import { isNotNull, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { z } from "zod";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { getStaticLastmod } from "@/lib/seo/lastmod";
import { STATIC_PAGES } from "@/lib/seo/static-pages";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { getPublicSiteUrl } from "@/lib/utils/site-url";
import { escapeXml } from "@/lib/utils/xml";

const SITEMAP_XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9";

export const URLS_PER_SITEMAP = 50000;

export const STATIC_SITEMAP_ENTRY_COUNT =
  STATIC_PAGES.length + PROFESSIONS.length + BLOG_POSTS.length;

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

/** Newest `dateModified ?? date` across BLOG_POSTS: the /blog index changes when a post does. */
export function getNewestBlogPostDate(): Date {
  const newest = BLOG_POSTS.reduce(
    (latest, post) => {
      const postDate = post.dateModified ?? post.date;

      return postDate > latest ? postDate : latest;
    },
    BLOG_POSTS[0]?.dateModified ?? BLOG_POSTS[0]?.date ?? "1970-01-01",
  );

  return new Date(newest);
}

function parseTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Static entries with deterministic lastmods: page dates come from lastmod.json (bumped by the
 * pre-commit hook). `/explore` lists portfolios, so it moves with the newest publish when the DB
 * supplied one; otherwise it falls back to the newest blog date.
 */
function buildStaticSitemapEntries(
  baseUrl: string,
  newestPortfolioPublish: Date | null,
): MetadataRoute.Sitemap {
  const newestBlogPost = getNewestBlogPostDate();

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: page.path === "/" ? baseUrl : `${baseUrl}${page.path}`,
    lastModified:
      page.path === "/explore"
        ? (newestPortfolioPublish ?? newestBlogPost)
        : page.path === "/blog"
          ? newestBlogPost
          : getStaticLastmod(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  for (const profession of PROFESSIONS) {
    entries.push({
      url: `${baseUrl}/for/${profession.slug}`,
      lastModified: getStaticLastmod(`/for/${profession.slug}`),
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

export async function generateSitemapEntries(id: number): Promise<MetadataRoute.Sitemap | null> {
  if (!Number.isInteger(id) || id < 0) {
    return [];
  }

  const baseUrl = getPublicSiteUrl();
  const userEntries: MetadataRoute.Sitemap = [];
  let newestPortfolioPublish: Date | null = null;

  try {
    const db = getDb(env.HYPERDRIVE);

    const profiles = await db
      .select({
        handle: user.handle,
        userUpdatedAt: user.updatedAt,
        siteUpdatedAt: siteData.updatedAt,
        lastPublishedAt: siteData.lastPublishedAt,
        privacySettings: user.privacySettings,
        content: siteData.content,
      })
      .from(user)
      .innerJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(isNotNull(user.handle))
      .orderBy(user.handle, user.id);

    const indexableProfiles = profiles.filter(
      (profile) =>
        profile.handle !== null && isIndexableProfile(profile.content, profile.privacySettings),
    );

    newestPortfolioPublish = indexableProfiles.reduce<Date | null>((newest, profile) => {
      const publishedAt = parseTimestamp(profile.lastPublishedAt);

      return publishedAt && (!newest || publishedAt > newest) ? publishedAt : newest;
    }, null);

    if (id >= getSitemapShardCount(indexableProfiles.length)) return null;

    const { limit, offset } = getUserShardWindow(id);

    for (const entry of indexableProfiles.slice(offset, offset + limit)) {
      if (!entry.handle) continue;

      const lastModified = entry.lastPublishedAt || entry.siteUpdatedAt || entry.userUpdatedAt;
      const publishDate = entry.lastPublishedAt ? new Date(entry.lastPublishedAt) : null;
      const isRecent = publishDate && Date.now() - publishDate.getTime() < 7 * 24 * 60 * 60 * 1000;

      userEntries.push({
        url: `${baseUrl}/@${entry.handle}`,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
        changeFrequency: isRecent ? "daily" : "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    log("error", `Failed to generate sitemap ${id}`, { error: String(error) });
  }

  if (id !== 0) return userEntries;

  return [...buildStaticSitemapEntries(baseUrl, newestPortfolioPublish), ...userEntries];
}

export async function getTotalIndexableUserCount(): Promise<number> {
  const db = getDb(env.HYPERDRIVE);

  const profiles = await db
    .select({
      content: siteData.content,
      privacySettings: user.privacySettings,
    })
    .from(user)
    .innerJoin(siteData, sql`${siteData.userId} = ${user.id}`)
    .where(isNotNull(user.handle));

  return profiles.filter((profile) => isIndexableProfile(profile.content, profile.privacySettings))
    .length;
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
