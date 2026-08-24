import type { Database } from "@/lib/db";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";

/**
 * Transaction client accepted for statement construction: either the pooled
 * database or the tx handed to a `db.transaction(async (tx) => ...)` callback.
 */
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Build siteData upsert statement bound to the given db/tx (not executed).
 * Execute it inside a transaction callback together with the other writes of
 * the same logical operation.
 *
 * Always extracts preview fields from content for denormalized columns.
 * Previously the claim route's version skipped extractPreviewFields(),
 * leaving preview columns null for cached claims.
 *
 * @param db - Drizzle PG database or transaction instance
 * @param userId - Owner user ID (siteData.userId, unique)
 * @param resumeId - Active resume ID to link
 * @param content - Parsed portfolio content (stored as JSONB)
 * @param opts.publish - When true (default) marks site as published (lastPublishedAt=now).
 *                       When false sets lastPublishedAt=null so site remains unpublished.
 *                       Callers MUST pass publish=false when user.handle IS NULL to avoid
 *                       creating unreachable published sites; wizard sets handle then
 */
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
