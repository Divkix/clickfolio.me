/**
 * Cloudflare Cron Trigger handler for orphaned resume recovery (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker/index.ts calls
 * recoverOrphanedResumes() directly to avoid double Worker invocation billing.
 *
 * Scheduled every 15 minutes via wrangler.jsonc
 * Finds resumes stuck in pending_claim status that have valid r2Key and fileHash
 * but weren't successfully queued (e.g., due to worker crash after upload).
 *
 * @returns Response from {@link recoverOrphanedResumes} on success.
 * Returns 401 if cron secret is missing or invalid.
 * Returns 500 on server misconfiguration or recovery failure.
 */

import { getDb } from "@/lib/db";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { withCron } from "@/lib/cron/with-cron";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const dynamic = "force-dynamic";

export const GET = withCron(async (env) => {
  const db = getDb(env.HYPERDRIVE);
  const queue = env.CLICKFOLIO_PARSE_QUEUE;
  if (!queue) {
    console.error("CLICKFOLIO_PARSE_QUEUE not available");
    return createErrorResponse("Queue unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
  }
  return recoverOrphanedResumes(db, queue);
});
