/**
 * HTTP trigger for disposable email domain sync (manual trigger)
 *
 * Exists for manual triggers; the scheduled handler in worker.ts calls
 * syncDisposableDomains() directly to avoid double Worker invocation billing.
 *
 * Scheduled daily at 4 AM UTC via wrangler.jsonc
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { syncDisposableDomains } from "@/lib/cron/sync-disposable-domains";

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
    const kv = (env as { DISPOSABLE_DOMAINS?: KVNamespace }).DISPOSABLE_DOMAINS;
    if (!kv) {
      return Response.json(
        { error: "DISPOSABLE_DOMAINS KV namespace not configured" },
        { status: 500 },
      );
    }

    const result = await syncDisposableDomains(kv);
    return Response.json(result);
  } catch (error) {
    console.error("Sync disposable domains failed:", error);
    return Response.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
