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

export async function recoverOrphanedResumes(
  db: Database,
  queue: Queue<ResumeParseMessage>,
): Promise<RecoverOrphanedResult> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const tenMinutesAgo = new Date(Date.now() - WAITING_FOR_CACHE_TIMEOUT_MS).toISOString();

  const selectColumns = {
    id: resumes.id,
    userId: resumes.userId,
    status: resumes.status,
    r2Key: resumes.r2Key,
    fileHash: resumes.fileHash,
    totalAttempts: resumes.totalAttempts,
  };

  const [pendingOrphans, processingOrphans, queuedOrphans, waitingForCacheExpired] =
    await Promise.all([
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
      db
        .select({ id: resumes.id, status: resumes.status })
        .from(resumes)
        .where(and(eq(resumes.status, "waiting_for_cache"), lt(resumes.createdAt, tenMinutesAgo)))
        .limit(10),
    ]);

  // TOCTOU-guarded on still being `waiting_for_cache`. Run in parallel since rows are independent.
  const timeoutUpdate = buildWaitingForCacheTimeoutUpdate();
  const timeoutResults = await Promise.all(
    waitingForCacheExpired.map(async (row) => {
      try {
        const result = await db
          .update(resumes)
          .set({ status: timeoutUpdate.status, errorMessage: timeoutUpdate.errorMessage })
          .where(and(eq(resumes.id, row.id), eq(resumes.status, "waiting_for_cache")));
        const changes = result.count;
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

  for (const resume of orphanedResumes) {
    if (hasExceededMaxAttempts(resume.totalAttempts ?? 0)) {
      log("info", "skipping resume - max attempts reached", { resumeId: resume.id });
      continue;
    }

    try {
      const requeueResult = await db
        .update(resumes)
        .set({
          status: "queued",
          queuedAt: now,
        })
        .where(and(eq(resumes.id, resume.id), eq(resumes.status, resume.status)));
      const requeueChanges = requeueResult.count;
      if (requeueChanges === 0) {
        log("info", "skipping resume - status changed since selection", {
          resumeId: resume.id,
        });
        continue;
      }

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
