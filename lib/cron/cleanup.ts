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
 */

import { lt } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { handleChanges, uploadRateLimits } from "@/lib/db/schema";
import type { UnknownRecord } from "../types/json";

export interface CleanupResult extends UnknownRecord {
  ok: true;
  deleted: {
    rateLimits: number;
    handleChanges: number;
  };
  timestamp: string;
}

export async function performCleanup(db: Database): Promise<CleanupResult> {
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

  return {
    ok: true,
    deleted,
    timestamp: nowIso,
  };
}
