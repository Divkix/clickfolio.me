/**
 * HTTP trigger for disposable email domain sync (manual trigger)
 *
 * Exists for manual triggers; the scheduled handler in worker/index.ts calls
 * syncDisposableDomains() directly to avoid double Worker invocation billing.
 *
 * Scheduled daily at 4 AM UTC via wrangler.jsonc
 *
 * @returns Response from {@link syncDisposableDomains} on success.
 * Returns 401 if cron secret is missing or invalid.
 * Returns 500 on server misconfiguration or sync failure.
 */

import { env } from "cloudflare:workers";
import { requireCronAuth } from "@/lib/auth/middleware";
import { syncDisposableDomains } from "@/lib/cron/sync-disposable-domains";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  const authError = requireCronAuth(request, env);
  if (authError) return authError;

  try {
    const kv = (env as { CLICKFOLIO_DISPOSABLE_DOMAINS?: KVNamespace })
      .CLICKFOLIO_DISPOSABLE_DOMAINS;
    if (!kv) {
      return createErrorResponse(
        "CLICKFOLIO_DISPOSABLE_DOMAINS KV namespace not configured",
        ERROR_CODES.INTERNAL_ERROR,
        500,
      );
    }

    const result = await syncDisposableDomains(kv);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Sync disposable domains failed:", error);
    return createErrorResponse("Sync failed", ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
