/**
 * Cloudflare Cron Trigger handler for database cleanup
 *
 * Scheduled daily at 3 AM UTC via wrangler.jsonc
 * Deletes:
 * - Expired rate limits (expiresAt < now)
 * - Expired sessions (expiresAt < now)
 * - Old handleChanges (older than 90 days)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { handleChanges, pageViews, session, uploadRateLimits } from "@/lib/db/schema";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron secret header (basic auth for cron endpoints)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("Authorization");
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const nowIso = new Date().toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Delete expired rate limits (expiresAt is TEXT/ISO string)
    const rateLimitsResult = await db
      .delete(uploadRateLimits)
      .where(lt(uploadRateLimits.expiresAt, nowIso))
      .returning({ id: uploadRateLimits.id });

    // Delete expired sessions (expiresAt is TEXT/ISO string)
    const sessionsResult = await db
      .delete(session)
      .where(lt(session.expiresAt, nowIso))
      .returning({ id: session.id });

    // Archive old handleChanges (keep 90 days)
    const handleChangesResult = await db
      .delete(handleChanges)
      .where(lt(handleChanges.createdAt, ninetyDaysAgo))
      .returning({ id: handleChanges.id });

    // Delete page views older than 90 days
    const pageViewsResult = await db
      .delete(pageViews)
      .where(lt(pageViews.createdAt, ninetyDaysAgo))
      .returning({ id: pageViews.id });

    return Response.json({
      ok: true,
      deleted: {
        rateLimits: rateLimitsResult.length,
        sessions: sessionsResult.length,
        handleChanges: handleChangesResult.length,
        pageViews: pageViewsResult.length,
      },
      timestamp: nowIso,
    });
  } catch (error) {
    console.error("Cleanup cron failed:", error);
    return Response.json({ error: "Cleanup failed", details: String(error) }, { status: 500 });
  }
}
