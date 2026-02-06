/**
 * Cloudflare Cron Trigger handler for orphaned resume recovery (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker.ts calls
 * recoverOrphanedResumes() directly to avoid double Worker invocation billing.
 *
 * Scheduled every 15 minutes via wrangler.jsonc
 * Finds resumes stuck in pending_claim status that have valid r2Key and fileHash
 * but weren't successfully queued (e.g., due to worker crash after upload).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { getDb } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret header (basic auth for cron endpoints)
  // SECURITY: Fail-closed - reject all requests if CRON_SECRET is not configured
  if (!CRON_SECRET) {
    console.error("CRON_SECRET environment variable is not configured");
    return Response.json(
      { error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const queue = env.RESUME_PARSE_QUEUE;
    if (!queue) {
      console.error("RESUME_PARSE_QUEUE not available");
      return Response.json({ error: "Queue unavailable" }, { status: 500 });
    }

    const result = await recoverOrphanedResumes(db, queue);
    return Response.json(result);
  } catch (error) {
    console.error("Orphan recovery cron error:", error);
    return Response.json({ error: "Recovery failed", details: String(error) }, { status: 500 });
  }
}
