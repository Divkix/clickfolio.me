/**
 * Shared orphaned resume recovery logic.
 *
 * Called by:
 * - worker/index.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/recover-orphaned route handler (manual trigger via HTTP)
 *
 * Finds resumes stuck in pending_claim status that have valid r2Key and fileHash
 * but weren't successfully queued (e.g., due to worker crash after upload).
 */
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  buildWaitingForCacheTimeoutUpdate,
  hasExceededMaxAttempts,
  WAITING_FOR_CACHE_TIMEOUT_MS,
} from "@/lib/resume/lifecycle";
import { resumes } from "@/lib/db/schema";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";
import type { UnknownRecord } from "../types/json";
import { log } from "@/lib/utils/log";

export interface RecoverOrphanedResult extends UnknownRecord {
  recovered: number;
  found: number;
  timestamp: string;
}

type D1ChangesResult = { meta?: { changes?: number }; changes?: number } | null | undefined;

function getChanges(result: D1ChangesResult): number {
  return result?.meta?.changes ?? result?.changes ?? 0;
}

export async function recoverOrphanedResumes(
  db: Database,
  queue: Queue<ResumeParseMessage>,
): Promise<RecoverOrphanedResult> {
  // Thresholds: pending_claim = 5 min, processing = 15 min (AI parsing can take ~40s)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const tenMinutesAgo = new Date(Date.now() - WAITING_FOR_CACHE_TIMEOUT_MS).toISOString();

  const selectColumns = {
    id: resumes.id,
    userId: resumes.userId,
    // status is selected so the TOCTOU re-queue guard can condition on the
    // originally-selected status (see the update below).
    status: resumes.status,
    r2Key: resumes.r2Key,
    fileHash: resumes.fileHash,
    totalAttempts: resumes.totalAttempts,
  };

  // Run all queries in parallel — they hit different index prefixes.
  // The waiting_for_cache timeout is now handled here instead of in GET /status
  // (see lifecycle.waitingForCacheTimedOut) so the GET stays side-effect-free;
  // cron is the durable writer.
  const [pendingOrphans, processingOrphans, queuedOrphans, waitingForCacheExpired] =
    await Promise.all([
      // Resumes stuck in pending_claim (never queued, e.g. worker crash after upload)
      db
        .select(selectColumns)
        .from(resumes)
        .where(
          and(
            eq(resumes.status, "pending_claim"),
            isNotNull(resumes.r2Key),
            isNotNull(resumes.fileHash),
            lt(resumes.createdAt, fiveMinutesAgo),
          ),
        )
        .limit(10),
      // Resumes stuck in processing (consumer crashed mid-parse).
      // Age-gate on queuedAt (time-in-processing), not createdAt (row age), so a
      // manual retry of an old resume isn't treated as orphaned. Fall back to
      // createdAt for legacy rows that predate queuedAt.
      db
        .select(selectColumns)
        .from(resumes)
        .where(
          and(
            eq(resumes.status, "processing"),
            isNotNull(resumes.r2Key),
            isNotNull(resumes.fileHash),
            or(
              lt(resumes.queuedAt, fifteenMinutesAgo),
              and(isNull(resumes.queuedAt), lt(resumes.createdAt, fifteenMinutesAgo)),
            ),
          ),
        )
        .limit(10),
      // Resumes stuck in queued (publish failed after status write, never consumed).
      // Age-gate on queuedAt to avoid racing rows that were legitimately queued
      // moments ago. Fall back to createdAt for legacy rows with a null queuedAt.
      db
        .select(selectColumns)
        .from(resumes)
        .where(
          and(
            eq(resumes.status, "queued"),
            isNotNull(resumes.r2Key),
            isNotNull(resumes.fileHash),
            or(
              lt(resumes.queuedAt, fifteenMinutesAgo),
              and(isNull(resumes.queuedAt), lt(resumes.createdAt, fifteenMinutesAgo)),
            ),
          ),
        )
        .limit(10),
      // Resumes stuck in waiting_for_cache beyond the 10-min timeout.
      // These were previously transitioned inside GET /status (side-effect in a
      // polling GET); now they are presented virtually by GET and durably
      // transitioned here.
      db
        .select({ id: resumes.id, status: resumes.status })
        .from(resumes)
        .where(and(eq(resumes.status, "waiting_for_cache"), lt(resumes.createdAt, tenMinutesAgo)))
        .limit(10),
    ]);

  // Durably transition expired waiting_for_cache rows to failed.
  // TOCTOU-guarded on still being `waiting_for_cache`. Run in parallel since rows are independent.
  // Each row is individually try/caught so one D1 transient error does not abort the whole cron tick
  // (mirrors the per-row isolation of the sequential requeue loop below).
  const timeoutUpdate = buildWaitingForCacheTimeoutUpdate();
  const timeoutResults = await Promise.all(
    waitingForCacheExpired.map(async (row) => {
      try {
        const result = await db
          .update(resumes)
          .set({ status: timeoutUpdate.status, errorMessage: timeoutUpdate.errorMessage })
          .where(and(eq(resumes.id, row.id), eq(resumes.status, "waiting_for_cache")));
        const changes = getChanges(result);
        if (changes > 0) {
          log("info", "timed out waiting_for_cache resume", { resumeId: row.id });
        }
        return changes > 0 ? 1 : 0;
      } catch (error) {
        log("error", "failed to timeout waiting_for_cache resume", {
          resumeId: row.id,
          error: String(error),
        });
        return 0;
      }
    }),
  );
  const waitingForCacheTimedOutCount = timeoutResults.reduce<number>((a, b) => a + b, 0);

  // Merge and deduplicate (shouldn't overlap, but defensive)
  const seenIds = new Set<string>();
  const orphanedResumes = [...pendingOrphans, ...processingOrphans, ...queuedOrphans].filter(
    (r) => {
      if (seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    },
  );

  if (orphanedResumes.length === 0) {
    return {
      ok: true,
      recovered: waitingForCacheTimedOutCount,
      found: waitingForCacheExpired.length,
      timestamp: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString();
  const successfulIds: string[] = [];

  // Process resumes: update DB status first, then publish to queue
  // This prevents race condition where consumer sees old status
  for (const resume of orphanedResumes) {
    // Skip if already at max attempts
    if (hasExceededMaxAttempts(resume.totalAttempts ?? 0)) {
      log("info", "skipping resume - max attempts reached", { resumeId: resume.id });
      continue;
    }

    try {
      // Update DB status to "queued" BEFORE publishing to queue
      // This ensures consumer always sees the correct status.
      // TOCTOU guard: only re-queue if the row is STILL in the status we
      // selected it with — the consumer, a manual retry, or a prior recovery
      // pass may have moved it in the meantime (0 rows updated = skip).
      // totalAttempts is intentionally NOT incremented here: the queue consumer
      // already increments it per actual attempt, so an increment here would
      // double-count every recovered resume.
      const requeueResult = await db
        .update(resumes)
        .set({
          status: "queued",
          queuedAt: now,
        })
        .where(and(eq(resumes.id, resume.id), eq(resumes.status, resume.status)));
      const requeueChanges = getChanges(requeueResult);
      if (requeueChanges === 0) {
        log("info", "skipping resume - status changed since selection", {
          resumeId: resume.id,
        });
        continue;
      }

      // Now publish to queue (after DB is updated)
      await publishResumeParse(queue, {
        resumeId: resume.id,
        userId: resume.userId,
        r2Key: resume.r2Key,
        // SAFETY: orphaned resumes are filtered to have non-null r2Key/fileHash (isNotNull checks in queries); fileHash is guaranteed string here.
        fileHash: resume.fileHash as string,
        attempt: (resume.totalAttempts ?? 0) + 1,
      });

      successfulIds.push(resume.id);
      log("info", "recovered orphaned resume", { resumeId: resume.id });
    } catch (error) {
      log("error", "failed to recover resume", { resumeId: resume.id, error: String(error) });
      // Roll status back to pending_claim so the next recovery pass retries it
      // rather than leaving it stuck in "queued".
      // TOCTOU guard: only roll back if the row is STILL "queued" — if the
      // consumer already picked it up (processing) or another path moved it,
      // leave it alone.
      try {
        await db
          .update(resumes)
          .set({ status: "pending_claim", queuedAt: null })
          .where(and(eq(resumes.id, resume.id), eq(resumes.status, "queued")));
      } catch (rollbackError) {
        log("error", "failed to roll back resume", {
          resumeId: resume.id,
          error: String(rollbackError),
        });
      }
    }
  }

  const recovered = successfulIds.length + waitingForCacheTimedOutCount;

  return {
    ok: true,
    recovered,
    found: orphanedResumes.length + waitingForCacheExpired.length,
    timestamp: now,
  };
}
