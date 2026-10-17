import { and, asc, eq, gt, gte, isNull, or } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { siteData } from "@/lib/db/schema";
import { isIndexableContent } from "@/lib/seo/profile-indexability";
import type { ResumeContent } from "@/lib/types/database";

export interface BackfillResult {
  updated: number;
  indexable: number;
  /** Rows whose stored content made the predicate throw; stored as not indexable. */
  malformed: number;
}

// A row skipped because its content changed mid-pass is retried on the next pass; a row that keeps
// changing is left for the next run rather than looping forever.
const MAX_PASSES = 5;

/** `null` when the stored content is malformed enough to make the predicate throw. */
function tryIsIndexableContent(content: ResumeContent): boolean | null {
  try {
    return isIndexableContent(content);
  } catch {
    return null;
  }
}

/**
 * Computes `site_data.content_indexable` for rows where it is NULL (written before the column or
 * by code that does not set it) and, with `updatedSince`, also recomputes every row whose content
 * changed since then: code that predates the flag rewrites content without touching it, so a flag
 * set earlier can go stale (e.g. the old Worker serving writes between the pre-deploy backfill
 * and `wrangler deploy`, or after a rollback). Idempotent.
 *
 * Each update is guarded by the `updated_at` it read, so a concurrent content write is never
 * stamped with a flag computed from the old content; such rows are re-read on another pass.
 */
export async function backfillContentIndexable(
  db: PgQueryable,
  { batchSize = 100, updatedSince }: { batchSize?: number; updatedSince?: string } = {},
): Promise<BackfillResult> {
  const result: BackfillResult = { updated: 0, indexable: 0, malformed: 0 };

  const needsFlag = updatedSince
    ? or(isNull(siteData.contentIndexable), gte(siteData.updatedAt, updatedSince))
    : isNull(siteData.contentIndexable);

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let skipped = 0;
    let afterId = "";

    for (;;) {
      const rows = await db
        .select({ id: siteData.id, content: siteData.content, updatedAt: siteData.updatedAt })
        .from(siteData)
        .where(and(needsFlag, gt(siteData.id, afterId)))
        .orderBy(asc(siteData.id))
        .limit(batchSize);

      if (rows.length === 0) break;

      afterId = rows[rows.length - 1].id;

      for (const row of rows) {
        const verdict = tryIsIndexableContent(row.content);
        const indexable = verdict ?? false;

        const updated = await db
          .update(siteData)
          .set({ contentIndexable: indexable })
          .where(and(eq(siteData.id, row.id), eq(siteData.updatedAt, row.updatedAt)))
          .returning({ id: siteData.id });

        if (updated.length === 0) {
          skipped++;
          continue;
        }

        result.updated++;

        if (indexable) result.indexable++;

        if (verdict === null) result.malformed++;
      }
    }

    if (skipped === 0) break;
  }

  return result;
}
