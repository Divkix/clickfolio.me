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
  opts?: { publish?: boolean },
) {
  const now = new Date().toISOString();
  const previewFields = extractPreviewFields(content);
  const publish = opts?.publish ?? true;

  return db
    .insert(siteData)
    .values({
      id: crypto.randomUUID(),
      userId,
      resumeId,
      content,
      ...previewFields,
      lastPublishedAt: publish ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteData.userId,
      set: {
        resumeId,
        content,
        ...previewFields,
        updatedAt: now,
        // eslint-disable-next-line anti-slop/no-conditional-empty-object-spread -- publish=false must not overwrite lastPublishedAt to avoid destructive unpublish on stale race
        ...(publish ? { lastPublishedAt: now } : {}),
      },
    });
}
