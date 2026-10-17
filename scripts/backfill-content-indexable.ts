import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { backfillContentIndexable } from "@/lib/data/content-indexable-backfill";
import * as schema from "@/lib/db/schema";

// Sets site_data.content_indexable on rows where it is NULL. Safe to re-run; deploy.ts runs it
// after db:migrate and again after wrangler deploy (catches rows the old Worker wrote in between).
// Uses the direct DATABASE_URL like drizzle-kit; the Worker never does.

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("[backfill] DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });

try {
  const result = await backfillContentIndexable(drizzle({ client: pool, schema }));

  console.log(
    `[backfill] content_indexable set on ${result.updated} row(s): ${result.indexable} indexable, ${result.malformed} malformed`,
  );
} catch (error) {
  console.error("[backfill] failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
