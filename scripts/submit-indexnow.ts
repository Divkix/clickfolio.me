import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { siteConfig } from "@/lib/config/site";
import {
  extractSitemapLocs,
  INDEXNOW_KEY,
  isStaticSiteUrl,
  filterSiteUrls,
} from "@/lib/seo/indexnow";
import { enqueueIndexNowUrls } from "@/lib/seo/indexnow-outbox";
import { errorFields } from "@/lib/utils/error-fields";

// Post-deploy durable enqueue for static pages, /for/* and /blog/*. Portfolio changes use the
// same outbox at runtime. Reads the LIVE sitemap; the minute cron handles throttled delivery.
// INDEXNOW_DRY_RUN=1 lists URLs without storing them. Enqueue failure never fails a deploy.

const ATTEMPTS = 8;

const RETRY_DELAY_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });

  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  return response.text();
}

/** Waits until the new deployment serves the key file and the sitemap index. */
async function waitForLiveSitemap(): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const key = await fetchText(`${siteConfig.url}/${INDEXNOW_KEY}.txt`);

      if (key.trim() !== INDEXNOW_KEY) throw new Error("key file does not match INDEXNOW_KEY");

      return await fetchText(`${siteConfig.url}/sitemap.xml`);
    } catch (error) {
      lastError = error;
      console.log(`[indexnow] site not ready (attempt ${attempt}/${ATTEMPTS}): ${String(error)}`);

      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function collectStaticUrls(indexXml: string): Promise<string[]> {
  const locs = extractSitemapLocs(indexXml);
  const shardUrls = locs.filter((loc) => new URL(loc).pathname.endsWith(".xml"));
  // A plain urlset (no index) has page URLs directly.
  const pageUrls = shardUrls.length === locs.length ? [] : locs;

  for (const shard of shardUrls) {
    pageUrls.push(...extractSitemapLocs(await fetchText(shard)));
  }

  return pageUrls.filter(isStaticSiteUrl);
}

async function main(): Promise<void> {
  try {
    const urls = filterSiteUrls(await collectStaticUrls(await waitForLiveSitemap()));

    if (urls.length === 0) {
      console.log("[indexnow] no static URLs found; skipping");

      return;
    }

    if (process.env.INDEXNOW_DRY_RUN === "1") {
      console.log(`[indexnow] dry run, would submit ${urls.length} URLs:\n${urls.join("\n")}`);

      return;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) throw new Error("DATABASE_URL is required to enqueue IndexNow URLs");

    const pool = new Pool({ connectionString, max: 1 });

    try {
      await enqueueIndexNowUrls(drizzle({ client: pool, schema }), urls);
      console.log(`[indexnow] queued ${urls.length} URLs for durable submission`);
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.log("[indexnow] enqueue failed:", errorFields(error));
  }
}

await main();

process.exit(0);
