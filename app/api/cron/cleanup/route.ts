/**
 * Cloudflare Cron Trigger handler for database cleanup (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker/index.ts calls
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

import { getDb } from "@/lib/db";
import { performCleanup } from "@/lib/cron/cleanup";
import { withCron } from "@/lib/cron/with-cron";

export const GET = withCron(async (env) => performCleanup(getDb(env.CLICKFOLIO_DB)));
