/**
 * Shared orphaned resume recovery logic.
 *
 * Called by:
 * - worker.ts scheduled handler (direct invocation, no extra Worker billing)
 * - /api/cron/recover-orphaned route handler (manual trigger via HTTP)
 *
 * Finds resumes stuck in pending_claim status that have valid r2Key and fileHash
 * but weren't successfully queued (e.g., due to worker crash after upload).
 */

import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { resumes } from "@/lib/db/schema";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";

export interface RecoverOrphanedResult {
  ok: true;
  recovered: number;
  found: number;
  timestamp: string;
}

export async function recoverOrphanedResumes(
  db: Database,
  queue: Queue<ResumeParseMessage>,
): Promise<RecoverOrphanedResult> {
  // Thresholds: pending_claim = 5 min, processing = 15 min (AI parsing can take ~40s)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const selectColumns = {
    id: resumes.id,
    userId: resumes.userId,
    r2Key: resumes.r2Key,
    fileHash: resumes.fileHash,
    totalAttempts: resumes.totalAttempts,
  };

  // Run both queries in parallel — they hit different index prefixes
  const [pendingOrphans, processingOrphans] = await Promise.all([
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
    // Resumes stuck in processing (consumer crashed mid-parse)
    db
      .select(selectColumns)
      .from(resumes)
      .where(
        and(
          eq(resumes.status, "processing"),
          isNotNull(resumes.r2Key),
          isNotNull(resumes.fileHash),
          lt(resumes.createdAt, fifteenMinutesAgo),
        ),
      )
      .limit(10),
  ]);

  // Merge and deduplicate (shouldn't overlap, but defensive)
  const seenIds = new Set<string>();
  const orphanedResumes = [...pendingOrphans, ...processingOrphans].filter((r) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  if (orphanedResumes.length === 0) {
    return {
      ok: true,
      recovered: 0,
      found: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString();
  const successfulIds: string[] = [];

  // Process resumes: update DB status first, then publish to queue
  // This prevents race condition where consumer sees old status.
  // Sequential by design: each resume must have DB updated before queue publish.
  for (const resume of orphanedResumes) {
    // Skip if already at max attempts (6 total = 3 queue retries x 2 manual retries)
    if ((resume.totalAttempts ?? 0) >= 6) {
      console.log(`Skipping resume ${resume.id} - max attempts reached`);
      continue;
    }

    try {
      // Update DB status to "queued" BEFORE publishing to queue
      // This ensures consumer always sees the correct status
      await db
        .update(resumes)
        .set({
          status: "queued",
          queuedAt: now,
          totalAttempts: sql`${resumes.totalAttempts} + 1`,
        })
        .where(eq(resumes.id, resume.id));

      // Now publish to queue (after DB is updated)
      await publishResumeParse(queue, {
        resumeId: resume.id,
        userId: resume.userId,
        r2Key: resume.r2Key,
        fileHash: resume.fileHash as string,
        attempt: (resume.totalAttempts ?? 0) + 1,
      });

      successfulIds.push(resume.id);
      console.log(`Recovered orphaned resume: ${resume.id}`);
    } catch (error) {
      console.error(`Failed to recover resume ${resume.id}:`, error);
      // Note: If queue publish fails, resume remains in "queued" status
      // which is acceptable for orphaned recovery (resumes already stuck)
    }
  }

  const recovered = successfulIds.length;

  return {
    ok: true,
    recovered,
    found: orphanedResumes.length,
    timestamp: now,
  };
}
