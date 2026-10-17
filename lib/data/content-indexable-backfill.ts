import { and, asc, eq, isNull } from "drizzle-orm";
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

/** `null` when the stored content is malformed enough to make the predicate throw. */
function tryIsIndexableContent(content: ResumeContent): boolean | null {
  try {
    return isIndexableContent(content);
  } catch {
    return null;
  }
}

/**
 * Fills `site_data.content_indexable` for rows that predate the column (or were written by code
 * that did not set it). Idempotent: only touches NULL rows. Each update is guarded by the
 * `updated_at` it read, so a concurrent content write is never stamped with a flag computed from
 * the old content; that row stays NULL and the next batch re-reads it.
 */
export async function backfillContentIndexable(
  db: PgQueryable,
  { batchSize = 100 }: { batchSize?: number } = {},
): Promise<BackfillResult> {
  const result: BackfillResult = { updated: 0, indexable: 0, malformed: 0 };

  for (;;) {
    const rows = await db
      .select({ id: siteData.id, content: siteData.content, updatedAt: siteData.updatedAt })
      .from(siteData)
      .where(isNull(siteData.contentIndexable))
      .orderBy(asc(siteData.id))
      .limit(batchSize);

    if (rows.length === 0) return result;

    for (const row of rows) {
      const verdict = tryIsIndexableContent(row.content);
      const indexable = verdict ?? false;

      const updated = await db
        .update(siteData)
        .set({ contentIndexable: indexable })
        .where(
          and(
            eq(siteData.id, row.id),
            isNull(siteData.contentIndexable),
            eq(siteData.updatedAt, row.updatedAt),
          ),
        )
        .returning({ id: siteData.id });

      if (updated.length === 0) continue;

      result.updated++;

      if (indexable) result.indexable++;

      if (verdict === null) result.malformed++;
    }
  }
}
