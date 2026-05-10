/**
 * R2 storage cleanup for orphaned temp uploads
 *
 * Called by:
 * - worker.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/cleanup-r2 route handler (manual trigger via HTTP)
 *
 * Deletes:
 * - Temp files in R2 older than 24 hours that were never claimed
 */

const TEMP_PREFIX = "temp/";
const TEMP_CUTOFF_HOURS = 24;
const LIST_PAGE_SIZE = 1000;

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
    hasMore = listResult.truncated;
    // cursor only exists when truncated is true, use type assertion
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
