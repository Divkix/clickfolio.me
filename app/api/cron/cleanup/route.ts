/**
 * Cloudflare Cron Trigger handler for database cleanup (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker.ts calls
 * performCleanup() directly to avoid double Worker invocation billing.
 *
 * Scheduled daily at 3 AM UTC via wrangler.jsonc
 * Deletes:
 * - Expired rate limits (expiresAt < now)
 * - Expired sessions (expiresAt < now)
 * - Old handleChanges (older than 90 days)
 *
 * @returns Response from {@link performCleanup} on success.
 * Returns 401 if cron secret is missing or invalid.
 * Returns 500 on server misconfiguration or cleanup failure.
 */

import { env } from "cloudflare:workers";
import { requireCronAuth } from "@/lib/auth/middleware";
import { performCleanup } from "@/lib/cron/cleanup";
import { getDb } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const db = getDb(env.CLICKFOLIO_DB);
    const result = await performCleanup(db);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Cleanup cron failed:", error);
    return createErrorResponse("Cleanup failed", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
