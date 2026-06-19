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

import { env } from "cloudflare:workers";
import { requireCronAuth } from "@/lib/auth/middleware";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { getDb } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireCronAuth(request, env);
  if (authError) return authError;

  try {
    const db = getDb(env.CLICKFOLIO_DB);

    const queue = env.CLICKFOLIO_PARSE_QUEUE;
    if (!queue) {
      console.error("CLICKFOLIO_PARSE_QUEUE not available");
      return createErrorResponse("Queue unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    const result = await recoverOrphanedResumes(db, queue);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Orphan recovery cron error:", error);
    return createErrorResponse("Recovery failed", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
