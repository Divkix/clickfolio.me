import type { Database } from "@/lib/db";
import type { UnknownRecord } from "@/lib/types/json";
import { log } from "@/lib/utils/log";
const TEMP_PREFIX = "temp/";
const TEMP_CUTOFF_HOURS = 24;
const LIST_PAGE_SIZE = 1000;

const PENDING_DELETIONS_BATCH = 100;

const PENDING_DELETIONS_MAX_ATTEMPTS = 10;

export interface R2CleanupResult extends UnknownRecord {
  ok: true;
  deleted: number;
  failed: number;
  bytesFreed: number;
  timestamp: string;
}

export async function performR2Cleanup(binding: R2Bucket): Promise<R2CleanupResult> {
  const nowIso = new Date().toISOString();
  const cutoffTime = Date.now() - TEMP_CUTOFF_HOURS * 60 * 60 * 1000;

  let deleted = 0;
  let failed = 0;
  let bytesFreed = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const listResult = await binding.list({
      prefix: TEMP_PREFIX,
      limit: LIST_PAGE_SIZE,
      cursor,
    });

    const oldObjects = listResult.objects.filter((obj) => {
      const uploadTime = new Date(obj.uploaded).getTime();
      return uploadTime <= cutoffTime;
    });

    for (const obj of oldObjects) {
      try {
        if (obj.key.startsWith(TEMP_PREFIX)) {
          await binding.delete(obj.key);
          deleted++;
          bytesFreed += obj.size;
        }
      } catch (error) {
        log("error", "failed to delete R2 object", { key: obj.key, error: String(error) });
        failed++;
      }
    }

    // R2.list returns `truncated: true` when more objects exist beyond the current page.
    // The `cursor` is only present on the result when truncated is true, so we paginate
    // by passing it back into the next `list` call until truncated becomes false.
    hasMore = listResult.truncated;
    // SAFETY: R2 listResult with truncated true guarantees cursor presence per R2 API contract; cast narrows to paginated type for next page.
    cursor = hasMore ? (listResult as R2Objects & { truncated: true }).cursor : undefined;
  }

  if (deleted > 0 || failed > 0) {
    log("info", "R2 cleanup completed", { deleted, failed, bytesFreed });
  }

  return {
    ok: true,
    deleted,
    failed,
    bytesFreed,
    timestamp: nowIso,
  };
}

export interface PendingDeletionsResult extends UnknownRecord {
  ok: true;
  retried: number;
  succeeded: number;
  failed: number;
  skipped: number;
  timestamp: string;
}

export async function retryPendingR2Deletions(
  db: Database,
  binding: R2Bucket,
): Promise<PendingDeletionsResult> {
  const nowIso = new Date().toISOString();

  let retried = 0;
  let succeeded = 0;
  let failed = 0;

  // One transaction holds the row locks for the whole sweep: a second sweep skips these
  // rows instead of deleting the same objects twice and clobbering the attempt counts.
  await db.$client.begin(async (tx) => {
    const rows = await tx<Array<{ id: string; r2Key: string }>>`
      SELECT id, r2_key AS "r2Key" FROM pending_r2_deletions
      WHERE attempts < ${PENDING_DELETIONS_MAX_ATTEMPTS}
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${PENDING_DELETIONS_BATCH}
    `;
    retried = rows.length;

    for (const row of rows) {
      try {
        await binding.delete(row.r2Key);
        await tx`DELETE FROM pending_r2_deletions WHERE id = ${row.id}`;
        succeeded++;
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        log("error", "failed to retry pending R2 deletion", {
          id: row.id,
          r2Key: row.r2Key,
          error: errMessage,
        });
        // Increment in SQL: a read-modify-write here loses counts under overlapping sweeps.
        await tx`
          UPDATE pending_r2_deletions
          SET attempts = attempts + 1, last_error = ${errMessage}
          WHERE id = ${row.id}
        `;
        failed++;
      }
    }
  });

  // Rows at the attempt cap are excluded from the sweep above so they cannot starve
  // newer rows out of the batch; surface them for manual review instead.
  const cappedRows = await db.$client<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM pending_r2_deletions
    WHERE attempts >= ${PENDING_DELETIONS_MAX_ATTEMPTS}
  `;
  const skipped = cappedRows[0]?.count ?? 0;
  if (skipped > 0) {
    log("error", "pending R2 deletions reached max attempts; skipping for manual review", {
      skipped,
    });
  }

  if (succeeded > 0 || failed > 0 || skipped > 0) {
    log("info", "pending R2 deletions sweep", { succeeded, failed, skipped });
  }

  return {
    ok: true,
    retried,
    succeeded,
    failed,
    skipped,
    timestamp: nowIso,
  };
}
