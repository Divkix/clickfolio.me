import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/lib/db/schema";
import { siteData } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";

/**
 * Build siteData upsert query (not executed).
 * Returned so callers can include it in a db.batch() call for atomicity.
 *
 * Always extracts preview fields from content for denormalized columns.
 * Previously the claim route's version skipped extractPreviewFields(),
 * leaving preview columns null for cached claims.
 */
export function buildSiteDataUpsert(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  resumeId: string,
  content: string,
  now: string,
) {
  let parsedContent: ResumeContent | null = null;
  try {
    parsedContent = JSON.parse(content) as ResumeContent;
  } catch {
    console.warn(`Failed to parse content for preview fields extraction, resumeId: ${resumeId}`);
  }

  const previewFields = extractPreviewFields(parsedContent);

  return db
    .insert(siteData)
    .values({
      id: crypto.randomUUID(),
      userId,
      resumeId,
      content,
      ...previewFields,
      lastPublishedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteData.userId,
      set: {
        resumeId,
        content,
        ...previewFields,
        lastPublishedAt: now,
        updatedAt: now,
      },
    });
}
