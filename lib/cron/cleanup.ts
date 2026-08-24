/**
 * Shared cleanup logic for database maintenance.
 *
 * Called by:
 * - worker/index.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/cleanup route handler (manual trigger via HTTP)
 *
 * Deletes:
 * - Expired upload rate limits (expiresAt < now)
 * - Old handleChanges (older than 90 days)
 * - Failed resumes older than {@link FAILED_TTL_MS} (3 days), including their
 *   R2 objects; failed R2 deletes fall back to pendingR2Deletions retries
 */

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { handleChanges, pendingR2Deletions, resumes, uploadRateLimits } from "@/lib/db/schema";
import { R2 } from "../r2";
import type { UnknownRecord } from "../types/json";
import { log } from "../utils/log";

/** Failed resumes are purged this long after their last update. */
const FAILED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Maximum number of failed resumes purged per invocation. Bounds cron
 * duration; remaining rows are picked up on the next run.
 */
const FAILED_RESUMES_BATCH = 100;

export interface CleanupResult extends UnknownRecord {
  ok: true;
  deleted: {
    rateLimits: number;
    handleChanges: number;
    failedResumes: number;
  };
  timestamp: string;
}

export async function performCleanup(
  db: Database,
  r2Binding?: R2Bucket | null,
): Promise<CleanupResult> {
  const nowIso = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Run both DELETEs in a single PG transaction; each statement's postgres-js
  // RowList.count reports the affected-row count.
  const deleted = await db.transaction(async (tx) => {
    const rateLimitsCount = (
      await tx.delete(uploadRateLimits).where(lt(uploadRateLimits.expiresAt, nowIso))
    ).count;
    const handleChangesCount = (
      await tx.delete(handleChanges).where(lt(handleChanges.createdAt, ninetyDaysAgo))
    ).count;
    return { rateLimits: rateLimitsCount, handleChanges: handleChangesCount };
  });

  // Auto-purge failed resumes past the TTL. R2 object deletion is best-effort:
  // a failed delete is recorded durably in pending_r2_deletions so the daily
  // retry sweep finishes the job, and the DB row is removed either way. Any
  // purge error is logged and skipped so the core cleanup still reports.
  let failedResumes = 0;
  try {
    const cutoff = new Date(Date.now() - FAILED_TTL_MS).toISOString();
    const staleFailed = await db
      .select({
        id: resumes.id,
        r2Key: resumes.r2Key,
        updatedAt: resumes.updatedAt,
        createdAt: resumes.createdAt,
      })
      .from(resumes)
      .where(
        and(
          eq(resumes.status, "failed"),
          lt(sql`COALESCE(${resumes.updatedAt}, ${resumes.createdAt})`, cutoff),
        ),
      )
      .limit(FAILED_RESUMES_BATCH);

    if (staleFailed.length > 0) {
      if (!r2Binding) {
        log("warn", "R2 binding unavailable; deleting failed resume DB rows only");
      }
      const fallbackRows: Array<typeof pendingR2Deletions.$inferInsert> = [];
      for (const row of staleFailed) {
        if (!r2Binding || !row.r2Key) continue;
        try {
          await R2.delete(r2Binding, row.r2Key);
        } catch (error) {
          log("warn", "failed-resume R2 delete deferred", {
            r2Key: row.r2Key,
            error: String(error),
          });
          fallbackRows.push({
            id: crypto.randomUUID(),
            r2Key: row.r2Key,
            createdAt: nowIso,
            attempts: 1,
          });
        }
      }
      if (fallbackRows.length > 0) {
        await db.insert(pendingR2Deletions).values(fallbackRows);
      }
      const staleIds = staleFailed.map((row) => row.id);
      failedResumes = (await db.delete(resumes).where(inArray(resumes.id, staleIds))).count;
    }
  } catch (error) {
    log("error", "failed-resume auto-purge failed", { error: String(error) });
  }

  return {
    ok: true,
    deleted: { ...deleted, failedResumes },
    timestamp: nowIso,
  };
}
