import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/lib/db/schema";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";

/**
 * Build siteData upsert query (not executed).
 * Returned so callers can include it in a db.batch() call for atomicity (ADR-0008).
 *
 * Always extracts preview fields from content for denormalized columns.
 * Previously the claim route's version skipped extractPreviewFields(),
 * leaving preview columns null for cached claims.
 *
 * @param db - Drizzle D1 database instance
 * @param userId - Owner user ID (siteData.userId, unique)
 * @param resumeId - Active resume ID to link
 * @param content - Raw JSON string content (stored as TEXT, parsed for preview extraction)
 * @param now - ISO timestamp for createdAt/updatedAt/lastPublishedAt
 * @param opts.publish - When true (default) marks site as published (lastPublishedAt=now).
 *                       When false sets lastPublishedAt=null so site remains unpublished.
 *                       Callers MUST pass publish=false when user.handle IS NULL to avoid
 *                       creating unreachable published sites; wizard sets handle then
 *                       re-upserts with publish=true.
 */
export function buildSiteDataUpsert(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  resumeId: string,
  content: string,
  now: string,
  opts?: { publish?: boolean },
) {
  let parsedContent: ResumeContent | null = null;
  try {
    // SAFETY: D1 content is schema-validated JSON written only by our queue consumer; JSON.parse failure is caught and returns null.
    parsedContent = JSON.parse(content) as ResumeContent;
  } catch {
    console.warn(`Failed to parse content for preview fields extraction, resumeId: ${resumeId}`);
  }

  const previewFields = extractPreviewFields(parsedContent);
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
        lastPublishedAt: publish ? now : null,
        updatedAt: now,
      },
    });
}
