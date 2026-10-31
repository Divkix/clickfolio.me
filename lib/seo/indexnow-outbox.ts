import { sql } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { indexNowUrls } from "@/lib/db/schema";
import { filterSiteUrls } from "@/lib/seo/indexnow";

/** Shared SQL for Worker Effects and the Node deploy script; no Workers-only imports. */
export async function enqueueIndexNowUrls(
  db: PgQueryable,
  urls: readonly string[],
  skipDebounce = false,
): Promise<void> {
  const unique = filterSiteUrls(urls);

  if (unique.length === 0) return;

  const now = new Date(Date.now()).toISOString();

  await db
    .insert(indexNowUrls)
    .values(unique.map((url) => ({ url, dueAt: now, urgent: skipDebounce })))
    .onConflictDoUpdate({
      target: indexNowUrls.url,
      set: {
        revision: sql`${indexNowUrls.revision} + 1`,
        pending: true,
        urgent: sql`${skipDebounce} OR (${indexNowUrls.pending} AND ${indexNowUrls.urgent})`,
        dueAt: sql`CASE
          WHEN ${skipDebounce} OR (${indexNowUrls.pending} AND ${indexNowUrls.urgent})
            THEN ${now}::timestamptz
          ELSE GREATEST(${now}::timestamptz,
            COALESCE(${indexNowUrls.lastSubmittedAt} + interval '10 minutes', ${now}::timestamptz))
          END`,
      },
    });
}
