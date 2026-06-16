/**
 * R2 storage cleanup for orphaned temp uploads and durable pending deletions.
 *
 * Called by:
 * - worker.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/cleanup-r2 route handler (manual trigger via HTTP)
 *
 * Deletes:
 * - Temp files in R2 older than 24 hours that were never claimed
 * - R2 files that failed deletion during account deletion (GDPR retry path)
 */

import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { pendingR2Deletions } from "@/lib/db/schema";

const TEMP_PREFIX = "temp/";
const TEMP_CUTOFF_HOURS = 24;
const LIST_PAGE_SIZE = 1000;

/**
 * Maximum number of pending deletions to sweep per cron invocation.
 * Keeps each invocation bounded; remaining rows are picked up on the next run.
 */
const PENDING_DELETIONS_BATCH = 100;

/**
 * After this many attempts the row is left in place (with an error log) for
 * manual review rather than endlessly retried.
 */
const PENDING_DELETIONS_MAX_ATTEMPTS = 10;

export interface R2CleanupResult {
  ok: true;
  deleted: number;
  failed: number;
  bytesFreed: number;
  timestamp: string;
}

/**
 * Performs cleanup of orphaned temp files in R2
 *
 * Lists all objects in the temp/ prefix, filters those older than 24 hours,
 * and deletes them. Handles pagination for buckets with many temp files.
 *
 * @param binding - R2Bucket binding from Cloudflare environment
 * @returns Cleanup result with counts and bytes freed
 */
export async function performR2Cleanup(binding: R2Bucket): Promise<R2CleanupResult> {
  const nowIso = new Date().toISOString();
  const cutoffTime = Date.now() - TEMP_CUTOFF_HOURS * 60 * 60 * 1000;

  let deleted = 0;
  let failed = 0;
  let bytesFreed = 0;
  let cursor: string | undefined;
  let hasMore = true;

  // Paginate through all temp files
  while (hasMore) {
    const listResult = await binding.list({
      prefix: TEMP_PREFIX,
      limit: LIST_PAGE_SIZE,
      cursor,
    });

    // Filter files older than or equal to 24 hours
    const oldObjects = listResult.objects.filter((obj) => {
      const uploadTime = new Date(obj.uploaded).getTime();
      return uploadTime <= cutoffTime;
    });

    // Delete old objects
    for (const obj of oldObjects) {
      try {
        // Only delete from temp/ prefix as safety check
        if (obj.key.startsWith(TEMP_PREFIX)) {
          await binding.delete(obj.key);
          deleted++;
          bytesFreed += obj.size;
        }
      } catch (error) {
        console.error(`Failed to delete R2 object ${obj.key}:`, error);
        failed++;
      }
    }

    // Check if there are more pages
    // R2.list returns `truncated: true` when more objects exist beyond the current page.
    // The `cursor` is only present on the result when truncated is true, so we paginate
    // by passing it back into the next `list` call until truncated becomes false.
    hasMore = listResult.truncated;
    cursor = hasMore ? (listResult as R2Objects & { truncated: true }).cursor : undefined;
  }

  if (deleted > 0 || failed > 0) {
    console.log(
      `R2 cleanup completed: ${deleted} deleted, ${failed} failed, ${bytesFreed} bytes freed`,
    );
  }

  return {
    ok: true,
    deleted,
    failed,
    bytesFreed,
    timestamp: nowIso,
  };
}

export interface PendingDeletionsResult {
  ok: true;
  retried: number;
  succeeded: number;
  failed: number;
  skipped: number;
  timestamp: string;
}

/**
 * Sweeps the `pending_r2_deletions` table and retries each outstanding delete.
 *
 * On success the row is removed. On failure the `attempts` counter and
 * `lastError` are updated. Once a row reaches {@link PENDING_DELETIONS_MAX_ATTEMPTS}
 * it is left untouched and an error is logged for manual review.
 *
 * @param db      - Drizzle D1 database instance
 * @param binding - R2Bucket binding from Cloudflare environment
 * @returns Result counts and timestamp
 */
export async function retryPendingR2Deletions(
  db: Database,
  binding: R2Bucket,
): Promise<PendingDeletionsResult> {
  const nowIso = new Date().toISOString();

  const pending = await db.select().from(pendingR2Deletions).limit(PENDING_DELETIONS_BATCH);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    if (row.attempts >= PENDING_DELETIONS_MAX_ATTEMPTS) {
      console.error(
        `Pending R2 deletion ${row.id} (key=${row.r2Key}) has reached max attempts (${row.attempts}); skipping for manual review`,
      );
      skipped++;
      continue;
    }

    try {
      await binding.delete(row.r2Key);
      await db.delete(pendingR2Deletions).where(eq(pendingR2Deletions.id, row.id));
      succeeded++;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to retry pending R2 deletion ${row.id} (key=${row.r2Key}):`, error);
      await db
        .update(pendingR2Deletions)
        .set({
          attempts: row.attempts + 1,
          lastError: errMessage,
        })
        .where(eq(pendingR2Deletions.id, row.id));
      failed++;
    }
  }

  if (succeeded > 0 || failed > 0 || skipped > 0) {
    console.log(
      `Pending R2 deletions sweep: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped (max attempts)`,
    );
  }

  return {
    ok: true,
    retried: pending.length,
    succeeded,
    failed,
    skipped,
    timestamp: nowIso,
  };
}
