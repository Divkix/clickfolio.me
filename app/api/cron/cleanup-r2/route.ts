/**
 * Cloudflare Cron Trigger handler for R2 storage cleanup (HTTP endpoint)
 *
 * Exists for manual triggers; the scheduled handler in worker.ts calls
 * performR2Cleanup() directly to avoid double Worker invocation billing.
 *
 * Scheduled daily at 2 AM UTC via wrangler.jsonc
 * Deletes:
 * - Orphaned temp files in R2 older than 24 hours
 */

import { env } from "cloudflare:workers";
import { performR2Cleanup } from "@/lib/cron/cleanup-r2";
import { getR2Binding } from "@/lib/r2";

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
    const r2Binding = getR2Binding(env);
    if (!r2Binding) {
      return Response.json({ error: "R2 bucket not available" }, { status: 500 });
    }

    const result = await performR2Cleanup(r2Binding);
    return Response.json(result);
  } catch (error) {
    console.error("R2 cleanup cron failed:", error);
    return Response.json({ error: "R2 cleanup failed", details: String(error) }, { status: 500 });
  }
}
