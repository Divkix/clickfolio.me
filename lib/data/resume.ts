import { env } from "cloudflare:workers";
import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";

import { cache } from "react";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { generateBreadcrumbJsonLd, generateResumeJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { DEFAULT_THEME, isValidThemeId, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";
import { extractCityState, normalizePrivacySettings } from "@/lib/utils/privacy";

interface ResumeData {
  profile: {
    id: string;
    handle: string;
    email: string;
    avatar_url: string | null;
    headline: string | null;
  };
  content: ResumeContent;
  theme_id: ThemeId | null;
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
  jsonLdResumeScript: string | null;
  jsonLdBreadcrumbScript: string | null;
}

async function fetchResumeDataRaw(handle: string): Promise<ResumeData | null> {
  const db = getDb(env.HYPERDRIVE);

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
    },
    with: {
      siteData: {
        columns: {
          content: true,
          themeId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!userData) {
    return null;
  }

  if (!userData.siteData) {
    return null;
  }

  let content = userData.siteData.content;

  const privacySettings = normalizePrivacySettings(userData.privacySettings);

  // SAFETY: DB themeId is string|null validated immediately after via isValidThemeId; cast narrows to ThemeId for metadata lookup with fallback to DEFAULT_THEME
  let themeId: ThemeId | null = userData.siteData.themeId as ThemeId | null;
  if (!themeId || !isValidThemeId(themeId)) {
    themeId = DEFAULT_THEME;
  }

  if (content.contact) {
    content = {
      ...content,
      contact: { ...content.contact },
    };

    if (!privacySettings.show_phone && content.contact.phone) {
      delete content.contact.phone;
    }

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

async function fetchResumeMetadataRaw(handle: string): Promise<ResumeMetadata | null> {
  const db = getDb(env.HYPERDRIVE);

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

  const fullName = userData.siteData.previewName?.trim() || userData.name?.trim() || null;

  if (!fullName) {
    return null;
  }

  const parsedSettings = normalizePrivacySettings(userData.privacySettings);
  const hideFromSearch = parsedSettings.hide_from_search;
  const parsedSkills = normalizePreviewSkills(userData.siteData.previewSkills);

  let previewLocation = userData.siteData.previewLocation?.trim() || null;
  if (previewLocation && !parsedSettings.show_address) {
    previewLocation = extractCityState(previewLocation) || null;
  }

  let jsonLdResumeScript: string | null = null;
  let jsonLdBreadcrumbScript: string | null = null;

  if (userData?.siteData?.content && !hideFromSearch) {
    try {
      // SAFETY: content is schema-validated JSONB written by the queue consumer and /api/resume/update; cast bridges the column's wide Record type.
      const content = userData.siteData.content as ResumeContent;
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
    location: previewLocation,
    skills: parsedSkills.length > 0 ? parsedSkills : null,
    created_at: userData.siteData.createdAt,
    updated_at: userData.siteData.updatedAt,
    jsonLdResumeScript,
    jsonLdBreadcrumbScript,
  };
}

export const getResumeData = cache((handle: string) => fetchResumeDataRaw(handle));

export const getResumeMetadata = cache((handle: string) => fetchResumeMetadataRaw(handle));

export const getRelatedProfiles = cache(
  async (
    currentHandle: string,
    _skills?: string[] | null,
    _headline?: string | null,
  ): Promise<Array<{ handle: string; name: string; headline?: string | null }>> => {
    const db = getDb(env.HYPERDRIVE);

    const notHiddenFromSearch = or(
      sql`${user.privacySettings}->>'hide_from_search' IS NULL`,
      sql`${user.privacySettings}->>'hide_from_search' = 'false'`,
    );

    const whereClause = and(
      isNotNull(user.handle),
      ne(user.handle, currentHandle),
      notHiddenFromSearch,
      isNotNull(siteData.userId),
    );

    const WINDOW = 12;
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
      .orderBy(user.handle)
      .limit(WINDOW)
      .offset(offset);

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
