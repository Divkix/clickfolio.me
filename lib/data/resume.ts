import { env } from "cloudflare:workers";
import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";

import { cache } from "react";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { generateBreadcrumbJsonLd, generateResumeJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import {
  DEFAULT_THEME,
  isThemeUnlocked,
  isValidThemeId,
  THEME_METADATA,
  type ThemeId,
} from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { parsePreviewSkills } from "@/lib/utils/preview-skills";
import { extractCityState, parsePrivacySettings } from "@/lib/utils/privacy";

interface ResumeData {
  profile: {
    id: string;
    handle: string;
    email: string;
    avatar_url: string | null;
    headline: string | null;
  };
  content: ResumeContent;
  theme_id: string | null;
  privacy_settings: PrivacySettings;
  created_at: string;
  updated_at: string;
}

interface ResumeMetadata {
  full_name: string;
  headline?: string | null;
  summary?: string | null;
  avatar_url: string | null;
  hide_from_search: boolean;
  location?: string | null;
  skills?: string[] | null;
  created_at: string;
  updated_at: string;
  /** Serialized JSON-LD script for the resume/Person schema, or null if hidden */
  jsonLdResumeScript: string | null;
  /** Serialized JSON-LD script for the breadcrumb schema, or null if hidden */
  jsonLdBreadcrumbScript: string | null;
}

/**
 * Fetch resume data from D1 via Drizzle WITHOUT using cookies.
 *
 * Privacy filtering is applied during fetch, so returned content
 * is already privacy-filtered.
 */
async function fetchResumeDataRaw(handle: string): Promise<ResumeData | null> {
  const db = getDb(env.CLICKFOLIO_DB);

  // Fetch user by handle with siteData relation
  const userData = await db.query.user.findFirst({
    where: eq(user.handle, handle),
    columns: {
      id: true,
      name: true,
      email: true,
      handle: true,
      headline: true,
      image: true,
      privacySettings: true,
      isPro: true,
      referralCount: true, // Denormalized field, avoids separate COUNT query
    },
    with: {
      siteData: true,
    },
  });

  if (!userData) {
    return null;
  }

  // Ensure siteData exists
  if (!userData.siteData) {
    return null;
  }

  // Parse content JSON (stored as text in D1)
  // Data is already validated at write time (/api/resume/update)
  // D1 is a trusted source - skip redundant Zod validation (saves 200-400ms)
  let content: ResumeContent;
  try {
    content = JSON.parse(userData.siteData.content) as ResumeContent;
  } catch (error) {
    console.error("Failed to parse site_data content for handle:", handle, error);
    return null;
  }

  // Parse privacy settings from JSON string
  const privacySettings = parsePrivacySettings(userData.privacySettings);

  // Defense-in-depth: Validate theme is unlocked before returning
  // This catches edge cases where theme was set directly in DB or via API bypass
  let themeId = userData.siteData.themeId;

  if (themeId && isValidThemeId(themeId)) {
    const themeMetadata = THEME_METADATA[themeId as ThemeId];

    // Only check referral count if theme requires referrals
    if (themeMetadata.referralsRequired > 0) {
      // Use denormalized field instead of COUNT query (saves ~15ms D1 roundtrip)
      const referralCount = userData.referralCount ?? 0;
      const isPro = userData.isPro ?? false;

      if (!isThemeUnlocked(themeId as ThemeId, referralCount, isPro)) {
        console.warn(
          `[theme-defense] User ${userData.id} has locked theme ${themeId}. Falling back to default.`,
        );
        themeId = DEFAULT_THEME;
      }
    }
  } else {
    themeId = DEFAULT_THEME;
  }

  // Create defensive copy of contact to avoid mutating parsed JSON
  if (content.contact) {
    content = {
      ...content,
      contact: { ...content.contact },
    };

    // Remove phone if privacy setting is false
    if (!privacySettings.show_phone && content.contact.phone) {
      delete content.contact.phone;
    }

    // Filter address to city/state only if privacy setting is false
    if (!privacySettings.show_address && content.contact.location) {
      content.contact.location = extractCityState(content.contact.location);
    }
  }

  return {
    profile: {
      id: userData.id,
      handle: userData.handle!,
      email: userData.email,
      avatar_url: userData.image,
      headline: userData.headline,
    },
    content,
    theme_id: themeId,
    privacy_settings: privacySettings,
    created_at: userData.siteData.createdAt,
    updated_at: userData.siteData.updatedAt,
  };
}

/**
 * Lightweight metadata fetcher for SEO.
 * Uses denormalized preview columns from siteData instead of parsing
 * the full content JSON blob (50-100KB), saving significant I/O and CPU.
 */
async function fetchResumeMetadataRaw(handle: string): Promise<ResumeMetadata | null> {
  const db = getDb(env.CLICKFOLIO_DB);

  const userData = await db.query.user.findFirst({
    where: eq(user.handle, handle),
    columns: {
      id: true,
      name: true,
      handle: true,
      image: true,
      headline: true,
      privacySettings: true,
    },
    with: {
      siteData: {
        columns: {
          previewName: true,
          previewHeadline: true,
          previewLocation: true,
          previewSkills: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!userData?.siteData) {
    return null;
  }

  // Use denormalized columns instead of parsing full content JSON
  const fullName = userData.siteData.previewName?.trim() || userData.name?.trim() || null;

  if (!fullName) {
    return null;
  }

  // Parse privacy settings for hide_from_search
  const parsedSettings = parsePrivacySettings(userData.privacySettings);
  const hideFromSearch = parsedSettings.hide_from_search;
  const parsedSkills = parsePreviewSkills(userData.siteData.previewSkills);

  // Generate JSON-LD structured data for rich search results
  let jsonLdResumeScript: string | null = null;
  let jsonLdBreadcrumbScript: string | null = null;

  if (!hideFromSearch && userData.siteData.content) {
    try {
      const content = JSON.parse(userData.siteData.content) as ResumeContent;
      const profileUrl = `${siteConfig.url}/@${handle}`;

      const jsonLd = generateResumeJsonLd(content, {
        profileUrl,
        avatarUrl: userData.image,
        dateCreated: userData.siteData.createdAt,
        dateModified: userData.siteData.updatedAt,
      });
      jsonLdResumeScript = serializeJsonLd(jsonLd);
      jsonLdBreadcrumbScript = serializeJsonLd(generateBreadcrumbJsonLd(handle, fullName));
    } catch (error) {
      console.error("Failed to generate JSON-LD for handle:", handle, error);
    }
  }

  return {
    full_name: fullName,
    headline: userData.siteData.previewHeadline?.trim() || userData.headline || null,
    summary: null,
    avatar_url: userData.image,
    hide_from_search: hideFromSearch,
    location: userData.siteData.previewLocation?.trim() || null,
    skills: parsedSkills.length > 0 ? parsedSkills : null,
    created_at: userData.siteData.createdAt,
    updated_at: userData.siteData.updatedAt,
    jsonLdResumeScript,
    jsonLdBreadcrumbScript,
  };
}

/**
 * Resume data fetcher with request-level deduplication.
 * Wrapped with React.cache() to avoid duplicate D1 queries when
 * both generateMetadata() and the page component call this function.
 *
 * @param handle - The user's unique handle
 * @returns Resume data or null if not found
 */
export const getResumeData = cache((handle: string) => fetchResumeDataRaw(handle));

/**
 * Metadata fetcher for SEO with request-level deduplication.
 */
export const getResumeMetadata = cache((handle: string) => fetchResumeMetadataRaw(handle));

/**
 * Fetch related public profiles for cross-linking on profile pages.
 * Returns a small randomized set of public profiles excluding the current one.
 */
export const getRelatedProfiles = cache(
  async (
    currentHandle: string,
    _skills?: string[] | null,
    _headline?: string | null,
  ): Promise<Array<{ handle: string; name: string; headline?: string | null }>> => {
    const db = getDb(env.CLICKFOLIO_DB);

    const notHiddenFromSearch = or(
      sql`json_extract(${user.privacySettings}, '$.hide_from_search') IS NULL`,
      sql`json_extract(${user.privacySettings}, '$.hide_from_search') = false`,
    );

    const whereClause = and(
      isNotNull(user.handle),
      ne(user.handle, currentHandle),
      notHiddenFromSearch,
      isNotNull(siteData.userId),
    );

    const WINDOW = 12; // small pool to randomize within
    const countRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(whereClause);
    const total = Number(countRows[0]?.n ?? 0);
    if (total === 0) return [];

    const maxOffset = Math.max(0, total - WINDOW);
    const offset = maxOffset > 0 ? Math.floor(Math.random() * (maxOffset + 1)) : 0;

    const rows = await db
      .select({
        handle: user.handle,
        name: siteData.previewName,
        headline: siteData.previewHeadline,
      })
      .from(user)
      .leftJoin(siteData, sql`${siteData.userId} = ${user.id}`)
      .where(whereClause)
      .orderBy(user.handle) // stable, indexable ordering — no random() sort
      .limit(WINDOW)
      .offset(offset);

    // shuffle the small window in memory and take 3
    const pool = rows.filter((r) => r.handle);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map((r) => ({
      handle: r.handle!,
      name: r.name?.trim() || r.handle!,
      headline: r.headline?.trim() || null,
    }));
  },
);
