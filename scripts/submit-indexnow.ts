import { siteConfig } from "@/lib/config/site";
import {
  extractSitemapLocs,
  INDEXNOW_KEY,
  isStaticSiteUrl,
  submitToIndexNow,
} from "@/lib/seo/indexnow";

// Post-deploy IndexNow ping for static pages, /for/* and /blog/*. Portfolios are pinged by the
// Worker on publish (lib/seo/indexnow-runtime.ts). Reads the LIVE sitemap so it submits exactly
// what production serves. INDEXNOW_DRY_RUN=1 lists the URLs without submitting. Always exits 0: IndexNow is a hint and must never fail a deploy.

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
    const urls = await collectStaticUrls(await waitForLiveSitemap());

    if (urls.length === 0) {
      console.log("[indexnow] no static URLs found; skipping");

      return;
    }

    if (process.env.INDEXNOW_DRY_RUN === "1") {
      console.log(`[indexnow] dry run, would submit ${urls.length} URLs:\n${urls.join("\n")}`);

      return;
    }

    const result = await submitToIndexNow(urls);

    console.log(
      `[indexnow] submitted ${result.submitted}/${urls.length} URLs (statuses: ${result.statuses.join(", ")})`,
    );
  } catch (error) {
    console.log(`[indexnow] skipped: ${String(error)}`);
  }
}

await main();

process.exit(0);
