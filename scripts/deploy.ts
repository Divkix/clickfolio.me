import { purgePublicPageCache } from "../lib/cloudflare-cache-purge";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const deploy = Bun.spawnSync(["bunx", "wrangler", "deploy", ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (deploy.exitCode !== 0) {
    process.exit(deploy.exitCode ?? 1);
  }

  const { BETTER_AUTH_URL, CF_ZONE_ID, CF_CACHE_PURGE_API_TOKEN } = process.env;

  if (!BETTER_AUTH_URL || !CF_ZONE_ID || !CF_CACHE_PURGE_API_TOKEN) {
    console.log("Skipping public-page cache purge: missing BETTER_AUTH_URL/CF_ZONE_ID/API token.");
    return;
  }

  const purged = await purgePublicPageCache(BETTER_AUTH_URL, CF_ZONE_ID, CF_CACHE_PURGE_API_TOKEN);

  if (!purged) {
    console.warn("Deploy succeeded, but public-page cache purge failed.");
  }
}

await main();
