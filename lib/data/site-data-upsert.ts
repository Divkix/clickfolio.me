import { sql } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
import { siteDataContentColumns } from "@/lib/data/site-data-content";

export function buildSiteDataUpsert(
  db: PgQueryable,
  userId: string,
  resumeId: string,
  content: ResumeContent,
  opts?: { publish?: boolean; onlyIfUpdatedAtLte?: string },
) {
  const now = new Date().toISOString();
  const previewFields = extractPreviewFields(content);
  const contentColumns = siteDataContentColumns(content);
  const publish = opts?.publish ?? true;
  const onlyIfUpdatedAtLte = opts?.onlyIfUpdatedAtLte;
  // publish=false must not overwrite lastPublishedAt: an empty set omits the key so onConflictDoUpdate leaves the column untouched.
  const lastPublishedAtSet = publish ? { lastPublishedAt: now } : {};

  const values = {
    id: crypto.randomUUID(),
    userId,
    resumeId,
    ...contentColumns,
    ...previewFields,
    lastPublishedAt: publish ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  // Stale writers (parse completion) skip the update when a newer row already landed after their snapshot.
  if (onlyIfUpdatedAtLte) {
    return db
      .insert(siteData)
      .values(values)
      .onConflictDoUpdate({
        target: siteData.userId,
        set: {
          resumeId,
          ...contentColumns,
          ...previewFields,
          updatedAt: now,
          // publish=false must not overwrite lastPublishedAt to avoid destructive unpublish on stale race
          ...lastPublishedAtSet,
        },
        setWhere: sql`${siteData.updatedAt} <= ${onlyIfUpdatedAtLte}`,
      });
  }

  return db
    .insert(siteData)
    .values(values)
    .onConflictDoUpdate({
      target: siteData.userId,
      set: {
        resumeId,
        ...contentColumns,
        ...previewFields,
        updatedAt: now,
        // publish=false must not overwrite lastPublishedAt to avoid destructive unpublish on stale race
        ...lastPublishedAtSet,
      },
    });
}
