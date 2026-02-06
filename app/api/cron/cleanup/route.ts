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
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { performCleanup } from "@/lib/cron/cleanup";
import { getDb } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

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

    const result = await performCleanup(db);
    return Response.json(result);
  } catch (error) {
    console.error("Cleanup cron failed:", error);
    return Response.json({ error: "Cleanup failed", details: String(error) }, { status: 500 });
  }
}
