import { spawnSync } from "node:child_process";

/**
 * Deploys to Cloudflare Workers.
 *
 * Order matters: `pnpm build` runs FIRST so Wrangler ships fresh output, and
 * it is the step that uploads source maps — a failed upload aborts the deploy
 * before Wrangler touches production.
 *
 * - Real deploy: POSTHOG_UPLOAD_SOURCEMAPS=true (build uploads source maps).
 * - `--dry-run`: POSTHOG_UPLOAD_SOURCEMAPS=false (no upload, no mutation).
 *
 * Credentials come from the gitignored local env (.env.production.local) via
 * Vite's loadEnv; they are never passed on the command line or logged.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const dryRun = args.includes("--dry-run");

  const build = spawnSync("pnpm", ["run", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      POSTHOG_UPLOAD_SOURCEMAPS: dryRun ? "false" : "true",
    },
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const deploy = spawnSync("pnpm", ["exec", "wrangler", "deploy", ...args], {
    stdio: "inherit",
  });
  if (deploy.status !== 0) {
    process.exit(deploy.status ?? 1);
  }
}

await main();
