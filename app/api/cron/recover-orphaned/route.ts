/**
 * Cloudflare Cron Trigger handler for orphaned resume recovery
 *
 * Scheduled every 15 minutes via wrangler.jsonc
 * Finds resumes stuck in pending_claim status that have valid r2Key and fileHash
 * but weren't successfully queued (e.g., due to worker crash after upload).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { resumes } from "@/lib/db/schema";
import { publishResumeParse } from "@/lib/queue/resume-parse";

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret header (basic auth for cron endpoints)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("Authorization");
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Find orphaned resumes older than 5 minutes
    // (gives normal flow time to complete)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const orphanedResumes = await db
      .select({
        id: resumes.id,
        userId: resumes.userId,
        r2Key: resumes.r2Key,
        fileHash: resumes.fileHash,
        totalAttempts: resumes.totalAttempts,
      })
      .from(resumes)
      .where(
        and(
          eq(resumes.status, "pending_claim"),
          isNotNull(resumes.r2Key),
          isNotNull(resumes.fileHash),
          lt(resumes.createdAt, fiveMinutesAgo),
        ),
      )
      .limit(10); // Process max 10 per run to avoid overwhelming queue

    if (orphanedResumes.length === 0) {
      return Response.json({
        ok: true,
        recovered: 0,
        found: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const queue = env.RESUME_PARSE_QUEUE;
    if (!queue) {
      console.error("RESUME_PARSE_QUEUE not available");
      return Response.json({ error: "Queue unavailable" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const successfulIds: string[] = [];

    // Process queue publishes and collect successful IDs
    for (const resume of orphanedResumes) {
      // Skip if already at max attempts (6 total = 3 queue retries x 2 manual retries)
      if ((resume.totalAttempts ?? 0) >= 6) {
        console.log(`Skipping resume ${resume.id} - max attempts reached`);
        continue;
      }

      try {
        // Re-publish to queue
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
      }
    }

    // Batch update all successful resumes in single DB call
    if (successfulIds.length > 0) {
      await db
        .update(resumes)
        .set({
          status: "queued",
          queuedAt: now,
          totalAttempts: sql`${resumes.totalAttempts} + 1`,
        })
        .where(inArray(resumes.id, successfulIds));
    }

    const recovered = successfulIds.length;

    return Response.json({
      ok: true,
      recovered,
      found: orphanedResumes.length,
      timestamp: now,
    });
  } catch (error) {
    console.error("Orphan recovery cron error:", error);
    return Response.json({ error: "Recovery failed", details: String(error) }, { status: 500 });
  }
}
