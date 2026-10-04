import { log } from "@/lib/utils/log";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { cache } from "react";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { generateBreadcrumbJsonLd, generateResumeJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
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
  indexable: boolean;
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

  let indexable = false;
  let jsonLdResumeScript: string | null = null;
  let jsonLdBreadcrumbScript: string | null = null;

  if (userData.siteData.content) {
    try {
      // SAFETY: content is schema-validated JSONB written by the parse pipeline and /api/resume/update; cast bridges the column's wide Record type.
      const content = userData.siteData.content as ResumeContent;
      indexable = isIndexableProfile(content, parsedSettings);

      if (indexable) {
        const profileUrl = `${siteConfig.url}/@${handle}`;

        const jsonLd = generateResumeJsonLd(content, {
          profileUrl,
          avatarUrl: userData.image,
          dateCreated: userData.siteData.createdAt,
          dateModified: userData.siteData.updatedAt,
          privacySettings: parsedSettings,
        });

        if (jsonLd) {
          jsonLdResumeScript = serializeJsonLd(jsonLd);
          jsonLdBreadcrumbScript = serializeJsonLd(generateBreadcrumbJsonLd(handle, fullName));
        }
      }
    } catch (error) {
      log("error", "Failed to generate JSON-LD for handle", { handle, error: String(error) });
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
    indexable,
    created_at: userData.siteData.createdAt,
    updated_at: userData.siteData.updatedAt,
    jsonLdResumeScript,
    jsonLdBreadcrumbScript,
  };
}

export const getResumeData = cache((handle: string) => fetchResumeDataRaw(handle));

export const getResumeMetadata = cache((handle: string) => fetchResumeMetadataRaw(handle));
