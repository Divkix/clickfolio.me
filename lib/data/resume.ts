import { log } from "@/lib/utils/log";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { cacheForRequest } from "vinext/cache";
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

/** The user columns plus the site_data columns both projections below read. */
interface ProfileRow {
  id: string;
  name: string;
  handle: string | null;
  headline: string | null;
  image: string | null;
  privacySettings: PrivacySettings;
  siteData: {
    content: ResumeContent;
    themeId: string | null;
    previewName: string | null;
    previewHeadline: string | null;
    previewLocation: string | null;
    previewSkills: string[] | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

/**
 * The request's only query: every column either projection below reads, so
 * `generateMetadata` and the page body can share one row.
 */
async function fetchResumeRow(handle: string): Promise<ProfileRow | undefined> {
  const db = getDb(env.HYPERDRIVE);

  return db.query.user.findFirst({
    where: eq(user.handle, handle),
    columns: {
      id: true,
      name: true,
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
          previewName: true,
          previewHeadline: true,
          previewLocation: true,
          previewSkills: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

type ResumeSiteData = NonNullable<ProfileRow["siteData"]>;

/** What the page renders. */
function buildResumeData(row: ProfileRow, siteData: ResumeSiteData): ResumeData {
  const privacySettings = normalizePrivacySettings(row.privacySettings);

  // SAFETY: DB themeId is string|null validated immediately after via isValidThemeId; cast narrows to ThemeId for metadata lookup with fallback to DEFAULT_THEME
  let themeId: ThemeId | null = siteData.themeId as ThemeId | null;

  if (!themeId || !isValidThemeId(themeId)) {
    themeId = DEFAULT_THEME;
  }

  let content = siteData.content;

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
      id: row.id,
      handle: row.handle!,
      avatar_url: row.image,
      headline: row.headline,
    },
    content,
    theme_id: themeId,
    privacy_settings: privacySettings,
    created_at: siteData.createdAt,
    updated_at: siteData.updatedAt,
  };
}

/** What `<head>`, OpenGraph and the JSON-LD scripts use. */
function buildResumeMetadata(
  row: ProfileRow,
  siteData: ResumeSiteData,
  handle: string,
): ResumeMetadata | null {
  const fullName = siteData.previewName?.trim() || row.name?.trim() || null;

  if (!fullName) {
    return null;
  }

  const privacySettings = normalizePrivacySettings(row.privacySettings);
  const parsedSkills = normalizePreviewSkills(siteData.previewSkills);

  let location = siteData.previewLocation?.trim() || null;

  if (location && !privacySettings.show_address) {
    location = extractCityState(location) || null;
  }

  let indexable = false;
  let jsonLdResumeScript: string | null = null;
  let jsonLdBreadcrumbScript: string | null = null;

  if (siteData.content) {
    try {
      // SAFETY: content is schema-validated JSONB written by the parse pipeline and /api/resume/update; cast bridges the column's wide Record type.
      const content = siteData.content as ResumeContent;
      indexable = isIndexableProfile(content, privacySettings);

      if (indexable) {
        const profileUrl = `${siteConfig.url}/@${handle}`;

        const jsonLd = generateResumeJsonLd(content, {
          profileUrl,
          avatarUrl: row.image,
          dateCreated: siteData.createdAt,
          dateModified: siteData.updatedAt,
          privacySettings,
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
    headline: siteData.previewHeadline?.trim() || row.headline || null,
    summary: null,
    avatar_url: row.image,
    hide_from_search: privacySettings.hide_from_search,
    location,
    skills: parsedSkills.length > 0 ? parsedSkills : null,
    indexable,
    created_at: siteData.createdAt,
    updated_at: siteData.updatedAt,
    jsonLdResumeScript,
    jsonLdBreadcrumbScript,
  };
}

interface PublicResume {
  data: ResumeData;
  metadata: ResumeMetadata | null;
}

async function loadPublicResume(handle: string): Promise<PublicResume | null> {
  const row = await fetchResumeRow(handle);

  if (!row?.siteData) {
    return null;
  }

  return {
    data: buildResumeData(row, row.siteData),
    metadata: buildResumeMetadata(row, row.siteData, handle),
  };
}

/**
 * Per-request memo for the row above. React's `cache()` does not span the
 * metadata and page render passes; `cacheForRequest` keys into vinext's
 * per-request WeakMap (node_modules/vinext/dist/shims/cache-for-request.js:59),
 * which lives in the request's AsyncLocalStorage context and is shared by every
 * nested shim scope, so both consumers await the same in-flight query.
 */
const getHandleLoads = cacheForRequest(() => new Map<string, Promise<PublicResume | null>>());

export function getResume(handle: string): Promise<PublicResume | null> {
  const loads = getHandleLoads();
  const loaded = loads.get(handle);

  if (loaded) {
    return loaded;
  }

  const pending = loadPublicResume(handle);

  loads.set(handle, pending);

  return pending;
}
