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

import { syncDisposableDomains } from "@/lib/cron/sync-disposable-domains";
import { withCron } from "@/lib/cron/with-cron";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const GET = withCron(async (env) => {
  // SAFETY: env is CloudflareEnv with optional CLICKFOLIO_DISPOSABLE_DOMAINS KV; cast bridges untyped env for manual cron trigger, existence checked below.
  const kv = (env as { CLICKFOLIO_DISPOSABLE_DOMAINS?: KVNamespace }).CLICKFOLIO_DISPOSABLE_DOMAINS;
  if (!kv) {
    return createErrorResponse(
      "CLICKFOLIO_DISPOSABLE_DOMAINS KV namespace not configured",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
  return syncDisposableDomains(kv);
});
