import { and, count, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { UserRole } from "@/lib/config/roles";
import type { PgQueryable } from "@/lib/db";
import type { PrivacySettings } from "@/lib/db/schema/auth";
import { siteData, user } from "@/lib/db/schema";
import { extractCityState, normalizePrivacySettings } from "@/lib/utils/privacy";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";

export interface DirectoryUser {
  handle: string;
  role: UserRole | null;
  previewName: string | null;
  previewHeadline: string | null;
  previewLocation: string | null;
  previewExpCount: number | null;
  previewEduCount: number | null;
  previewSkills: string[] | null;
}

/** The preview columns both directory queries select, before privacy/skills normalization. */
export type DirectoryUserRow = DirectoryUser & {
  privacySettings: PrivacySettings;
};

/** Applies the viewer-facing privacy rules to one directory row. */
export function toDirectoryUser(row: DirectoryUserRow): DirectoryUser {
  const previewSkills = normalizePreviewSkills(row.previewSkills);

  const previewLocation =
    row.previewLocation && !normalizePrivacySettings(row.privacySettings).show_address
      ? extractCityState(row.previewLocation)
      : row.previewLocation;

  return {
    handle: row.handle,
    role: row.role,
    previewName: row.previewName,
    previewHeadline: row.previewHeadline,
    previewLocation,
    previewExpCount: row.previewExpCount,
    previewEduCount: row.previewEduCount,
    previewSkills: previewSkills.length > 0 ? previewSkills : null,
  };
}

/**
 * SQL twin of `isIndexableProfile` over `user ⋈ site_data`, so list queries never load `content`.
 * The content half is the stored `content_indexable` flag (NULL = not backfilled yet, excluded).
 * The privacy half mirrors `!privacySettings.hide_from_search`: a missing or false key is
 * indexable, exactly like `normalizePrivacySettings`' default of `false`.
 */
export function indexableProfileCondition(): SQL {
  return sql`${siteData.contentIndexable} is true and (${user.privacySettings} -> 'hide_from_search') is distinct from 'true'::jsonb`;
}

/** `count(*) over ()`: the filtered total, carried on every row of a LIMIT/OFFSET page. */
const windowTotal = sql<number>`count(*) over ()`.mapWith(Number);

export type DirectoryRoleFilter = UserRole | "freelance" | "";

/**
 * One /explore page of indexable directory profiles, newest first. One statement is one snapshot,
 * so the page and its total always agree. `totalCount` is 0 when `page` is past the end (no row
 * is left to carry the window count); callers treat that as out of range.
 */
export async function getDirectoryPage(
  db: PgQueryable,
  {
    roleFilter,
    page,
    pageSize,
  }: { roleFilter: DirectoryRoleFilter; page: number; pageSize: number },
) {
  const conditions = [
    isNotNull(user.handle),
    eq(user.showInDirectory, true),
    eq(user.onboardingCompleted, true),
    indexableProfileCondition(),
  ];

  // "freelance" rides the same dropdown/param but filters the separate isFreelance flag.
  if (roleFilter === "freelance") {
    conditions.push(eq(user.isFreelance, true));
  } else if (roleFilter) {
    conditions.push(eq(user.role, roleFilter));
  }

  const rows = await db
    .select({
      handle: user.handle,
      role: user.role,
      previewName: siteData.previewName,
      previewHeadline: siteData.previewHeadline,
      previewLocation: siteData.previewLocation,
      previewExpCount: siteData.previewExpCount,
      previewEduCount: siteData.previewEduCount,
      previewSkills: siteData.previewSkills,
      privacySettings: user.privacySettings,
      totalCount: windowTotal,
    })
    .from(user)
    .innerJoin(siteData, eq(user.id, siteData.userId))
    .where(and(...conditions))
    .orderBy(desc(siteData.updatedAt), desc(siteData.userId))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const users = rows.flatMap(({ totalCount: _total, handle, ...row }) =>
    handle === null ? [] : [{ ...row, handle }],
  );

  return { users, totalCount: rows[0]?.totalCount ?? 0 };
}

/**
 * One sitemap window of indexable profiles in handle order, plus the filtered total and newest
 * publish across all of them (window aggregates, so one snapshot). Both are 0/null when the
 * window is past the end.
 */
export async function getIndexableProfileWindow(
  db: PgQueryable,
  { limit, offset }: { limit: number; offset: number },
) {
  const rows = await db
    .select({
      handle: user.handle,
      userUpdatedAt: user.updatedAt,
      siteUpdatedAt: siteData.updatedAt,
      lastPublishedAt: siteData.lastPublishedAt,
      totalCount: windowTotal,
      newestPublishedAt: sql`max(${siteData.lastPublishedAt}) over ()`.mapWith(
        siteData.lastPublishedAt,
      ),
    })
    .from(user)
    .innerJoin(siteData, eq(siteData.userId, user.id))
    .where(and(isNotNull(user.handle), indexableProfileCondition()))
    .orderBy(user.handle, user.id)
    .limit(limit)
    .offset(offset);

  return {
    profiles: rows.map(({ totalCount: _total, newestPublishedAt: _newest, ...row }) => row),
    totalCount: rows[0]?.totalCount ?? 0,
    newestPublishedAt: rows[0]?.newestPublishedAt ?? null,
  };
}

export async function countIndexableProfiles(db: PgQueryable): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(user)
    .innerJoin(siteData, eq(siteData.userId, user.id))
    .where(and(isNotNull(user.handle), indexableProfileCondition()));

  return row?.total ?? 0;
}
