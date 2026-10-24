import { Effect } from "effect";
import type { MetadataRoute } from "next";
import { z } from "zod";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { countIndexableProfiles, getIndexableProfileWindow } from "@/lib/data/indexable-profiles";
import { Db } from "@/lib/effect/db";
import type { DbConflict, DbFailed } from "@/lib/effect/failures";
import { retryLater } from "@/lib/effect/retry-later";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { getStaticLastmod } from "@/lib/seo/lastmod";
import { STATIC_PAGES } from "@/lib/seo/static-pages";
import { THEME_IDS, themeSlug } from "@/lib/templates/theme-ids";
import { getPublicSiteUrl } from "@/lib/utils/site-url";
import { escapeXml } from "@/lib/utils/xml";

const SITEMAP_XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9";

export const URLS_PER_SITEMAP = 50000;

export const STATIC_SITEMAP_ENTRY_COUNT =
  STATIC_PAGES.length +
  PROFESSIONS.length +
  THEME_IDS.length +
  EXAMPLE_GALLERIES.length +
  BLOG_POSTS.length;

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

function staticPageLastmod(
  path: string,
  newestPortfolioPublish: Date | null,
  newestBlogPost: Date,
): Date | undefined {
  if (path === "/explore") return newestPortfolioPublish ?? newestBlogPost;

  if (path === "/blog") return newestBlogPost;

  return getStaticLastmod(path);
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
    lastModified: staticPageLastmod(page.path, newestPortfolioPublish, newestBlogPost),
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

  for (const id of THEME_IDS) {
    const path = `/templates/${themeSlug(id)}`;
    entries.push({
      url: `${baseUrl}${path}`,
      lastModified: getStaticLastmod(path),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const gallery of EXAMPLE_GALLERIES) {
    const path = `/examples/${gallery.slug}`;
    entries.push({
      url: `${baseUrl}${path}`,
      lastModified: getStaticLastmod(path),
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

type UserWindow = Awaited<ReturnType<typeof getIndexableProfileWindow>>;

function userSitemapEntries(profiles: UserWindow["profiles"], baseUrl: string) {
  const userEntries: MetadataRoute.Sitemap = [];

  for (const entry of profiles) {
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

  return userEntries;
}

/**
 * One shard of the sitemap. A database failure fails the program and is never a shorter
 * sitemap: crawlers keep what they get, so the route answers 503 and they retry.
 */
export function generateSitemapEntries(
  id: number,
): Effect.Effect<MetadataRoute.Sitemap | null, DbFailed | DbConflict, Db> {
  if (!Number.isInteger(id) || id < 0) {
    return Effect.succeed([]);
  }

  const { limit, offset } = getUserShardWindow(id);

  // Indexability, the total and the newest publish are computed in SQL over the whole filtered
  // set (window aggregates), so the shard check and lastmods match one snapshot.
  return Db.use((service) =>
    service.query("sitemap.shard", (db) => getIndexableProfileWindow(db, { limit, offset })),
  ).pipe(
    Effect.map((shard) => {
      if (id >= getSitemapShardCount(shard.totalCount)) return null;

      const baseUrl = getPublicSiteUrl();
      const userEntries = userSitemapEntries(shard.profiles, baseUrl);

      if (id !== 0) return userEntries;

      const newestPortfolioPublish = parseTimestamp(shard.newestPublishedAt);

      return [...buildStaticSitemapEntries(baseUrl, newestPortfolioPublish), ...userEntries];
    }),
  );
}

export function getTotalIndexableUserCount(): Effect.Effect<number, DbFailed | DbConflict, Db> {
  return Db.use((service) => service.query("sitemap.count", (db) => countIndexableProfiles(db)));
}

const SITEMAP_RETRY_AFTER_SECONDS = 300;

/** The 503 for a sitemap request whose database read failed; route programs pipe failures here. */
export function sitemapUnavailable(path: string) {
  return retryLater(path, "Sitemap temporarily unavailable", SITEMAP_RETRY_AFTER_SECONDS);
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
