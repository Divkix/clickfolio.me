import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";

type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export function buildSiteDataUpsert(
  db: DbOrTx,
  userId: string,
  resumeId: string,
  content: ResumeContent,
  opts?: { publish?: boolean; onlyIfUpdatedAtLte?: string },
) {
  const now = new Date().toISOString();
  const previewFields = extractPreviewFields(content);
  const publish = opts?.publish ?? true;
  const onlyIfUpdatedAtLte = opts?.onlyIfUpdatedAtLte;
  // publish=false must not overwrite lastPublishedAt: an empty set omits the key so onConflictDoUpdate leaves the column untouched.
  const lastPublishedAtSet = publish ? { lastPublishedAt: now } : {};

  const values = {
    id: crypto.randomUUID(),
    userId,
    resumeId,
    content,
    ...previewFields,
    lastPublishedAt: publish ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  // Stale writers (queue completion) skip the update when a newer row already landed after their snapshot.
  if (onlyIfUpdatedAtLte) {
    return db
      .insert(siteData)
      .values(values)
      .onConflictDoUpdate({
        target: siteData.userId,
        set: {
          resumeId,
          content,
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
        content,
        ...previewFields,
        updatedAt: now,
        // publish=false must not overwrite lastPublishedAt to avoid destructive unpublish on stale race
        ...lastPublishedAtSet,
      },
    });
}
