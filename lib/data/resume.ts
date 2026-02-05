import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  DEFAULT_THEME,
  isThemeUnlocked,
  isValidThemeId,
  THEME_METADATA,
  type ThemeId,
} from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import {
  extractCityState,
  isValidPrivacySettings,
  normalizePrivacySettings,
  type PrivacySettingsType,
} from "@/lib/utils/privacy";

export interface ResumeData {
  profile: {
    id: string;
    handle: string;
    email: string;
    avatar_url: string | null;
    headline: string | null;
  };
  content: ResumeContent;
  theme_id: string | null;
  privacy_settings: PrivacySettingsType;
}

export interface ResumeMetadata {
  full_name: string;
  headline?: string | null;
  summary?: string | null;
  avatar_url: string | null;
  hide_from_search: boolean;
}

/**
 * Fetch resume data from D1 via Drizzle WITHOUT using cookies.
 *
 * Privacy filtering is applied during fetch, so returned content
 * is already privacy-filtered.
 */
async function fetchResumeDataRaw(handle: string): Promise<ResumeData | null> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

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
  let parsedPrivacySettings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search?: boolean;
  } | null = null;
  try {
    parsedPrivacySettings = userData.privacySettings ? JSON.parse(userData.privacySettings) : null;
  } catch {
    parsedPrivacySettings = null;
  }

  // Apply privacy filtering with type guard and normalization
  const privacySettings = normalizePrivacySettings(
    isValidPrivacySettings(parsedPrivacySettings) ? parsedPrivacySettings : null,
  );

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
  };
}

/**
 * Lightweight metadata fetcher for SEO.
 * Uses denormalized preview columns from siteData instead of parsing
 * the full content JSON blob (50-100KB), saving significant I/O and CPU.
 */
async function fetchResumeMetadataRaw(handle: string): Promise<ResumeMetadata | null> {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

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
        },
      },
    },
  });

  if (!userData || !userData.siteData) {
    return null;
  }

  // Use denormalized columns instead of parsing full content JSON
  const fullName =
    userData.siteData.previewName?.trim() || userData.name?.trim() || null;

  if (!fullName) {
    return null;
  }

  // Parse privacy settings for hide_from_search
  let hideFromSearch = false;
  if (userData.privacySettings) {
    try {
      const parsedSettings = JSON.parse(userData.privacySettings);
      hideFromSearch = parsedSettings?.hide_from_search === true;
    } catch {
      // Keep default false
    }
  }

  return {
    full_name: fullName,
    headline: userData.siteData.previewHeadline?.trim() || userData.headline || null,
    // summary not available from denormalized columns; consumer uses fallback description
    summary: null,
    avatar_url: userData.image,
    hide_from_search: hideFromSearch,
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
export const getResumeData = cache((handle: string) => {
  return fetchResumeDataRaw(handle);
});

/**
 * Metadata fetcher for SEO with request-level deduplication.
 */
export const getResumeMetadata = cache((handle: string) => {
  return fetchResumeMetadataRaw(handle);
});
