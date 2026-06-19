/**
 * Shared cleanup logic for database maintenance.
 *
 * Called by:
 * - worker/index.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/cleanup route handler (manual trigger via HTTP)
 *
 * Deletes:
 * - Expired rate limits (expiresAt < now)
 * - Expired sessions (expiresAt < now)
 * - Old handleChanges (older than 90 days)
 */

import { lt } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { handleChanges, session, uploadRateLimits } from "@/lib/db/schema";

export interface CleanupResult {
  ok: true;
  deleted: {
    rateLimits: number;
    sessions: number;
    handleChanges: number;
  };
  timestamp: string;
}

export async function performCleanup(db: Database): Promise<CleanupResult> {
  const nowIso = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Batch all 3 independent DELETEs into a single D1 roundtrip
  const [rateLimitsResult, sessionsResult, handleChangesResult] = await db.batch([
    db.delete(uploadRateLimits).where(lt(uploadRateLimits.expiresAt, nowIso)),
    db.delete(session).where(lt(session.expiresAt, nowIso)),
    db.delete(handleChanges).where(lt(handleChanges.createdAt, ninetyDaysAgo)),
  ]);

  return {
    ok: true,
    deleted: {
      rateLimits: rateLimitsResult.meta.changes,
      sessions: sessionsResult.meta.changes,
      handleChanges: handleChangesResult.meta.changes,
    },
    timestamp: nowIso,
  };
}
