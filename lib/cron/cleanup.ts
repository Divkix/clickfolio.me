import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { handleChanges, pendingR2Deletions, resumes, uploadRateLimits } from "@/lib/db/schema";
import { R2 } from "../r2";
import type { UnknownRecord } from "../types/json";
import { log } from "../utils/log";

const FAILED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

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

  const deleted = await db.transaction(async (tx) => {
    const rateLimitsCount = (
      await tx.delete(uploadRateLimits).where(lt(uploadRateLimits.expiresAt, nowIso))
    ).count;
    const handleChangesCount = (
      await tx.delete(handleChanges).where(lt(handleChanges.createdAt, ninetyDaysAgo))
    ).count;
    return { rateLimits: rateLimitsCount, handleChanges: handleChangesCount };
  });

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
