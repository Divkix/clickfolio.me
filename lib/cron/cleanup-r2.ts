import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { pendingR2Deletions } from "@/lib/db/schema";
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

  const pending = await db.select().from(pendingR2Deletions).limit(PENDING_DELETIONS_BATCH);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    if (row.attempts >= PENDING_DELETIONS_MAX_ATTEMPTS) {
      log("error", "pending R2 deletion reached max attempts; skipping for manual review", {
        id: row.id,
        r2Key: row.r2Key,
        attempts: row.attempts,
      });
      skipped++;
      continue;
    }

    try {
      await binding.delete(row.r2Key);
      await db.delete(pendingR2Deletions).where(eq(pendingR2Deletions.id, row.id));
      succeeded++;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      log("error", "failed to retry pending R2 deletion", {
        id: row.id,
        r2Key: row.r2Key,
        error: errMessage,
      });
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
    log("info", "pending R2 deletions sweep", { succeeded, failed, skipped });
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
