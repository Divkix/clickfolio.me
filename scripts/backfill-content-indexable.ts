import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { backfillContentIndexable } from "@/lib/data/content-indexable-backfill";
import * as schema from "@/lib/db/schema";

// Sets site_data.content_indexable on rows where it is NULL; `--since <ISO time>` also recomputes
// rows whose content changed since then. Safe to re-run. deploy.ts runs it after db:migrate, then
// again with --since after wrangler deploy (the old Worker rewrites content without the flag until
// the new one is live). Uses the direct DATABASE_URL like drizzle-kit; the Worker never does.

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("[backfill] DATABASE_URL is not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const sinceIndex = args.indexOf("--since");
const updatedSince = sinceIndex === -1 ? undefined : args[sinceIndex + 1];

if (sinceIndex !== -1 && (!updatedSince || Number.isNaN(Date.parse(updatedSince)))) {
  console.error(`[backfill] --since needs an ISO timestamp, got ${updatedSince ?? "no value"}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });

try {
  const result = await backfillContentIndexable(drizzle({ client: pool, schema }), {
    updatedSince,
  });

  console.log(
    `[backfill] content_indexable${updatedSince ? ` (NULL or updated since ${updatedSince})` : ""} set on ${result.updated} row(s): ${result.indexable} indexable, ${result.malformed} malformed`,
  );
} catch (error) {
  console.error("[backfill] failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
