import { spawnSync } from "node:child_process";

// Replaces the old 2am temp/ sweep: R2 expires anonymous uploads itself. `lifecycle set`
// overwrites every rule on the bucket, so r2-lifecycle.json lists all of them.
const R2_BUCKET = "clickfolio-bucket";

const R2_LIFECYCLE_FILE = "r2-lifecycle.json";

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

  if (!dryRun) {
    // Before `wrangler deploy`, so new code never runs against an old schema. Needs DATABASE_URL.
    const migrate = spawnSync("pnpm", ["run", "db:migrate"], { stdio: "inherit" });

    if (migrate.status !== 0) {
      process.exit(migrate.status ?? 1);
    }

    const lifecycle = spawnSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "r2",
        "bucket",
        "lifecycle",
        "set",
        R2_BUCKET,
        "--file",
        R2_LIFECYCLE_FILE,
        "--force",
      ],
      { stdio: "inherit" },
    );

    if (lifecycle.status !== 0) {
      process.exit(lifecycle.status ?? 1);
    }
  }

  const deploy = spawnSync("pnpm", ["exec", "wrangler", "deploy", ...args], {
    stdio: "inherit",
  });

  if (deploy.status !== 0) {
    process.exit(deploy.status ?? 1);
  }

  if (!dryRun) {
    // Best-effort search-engine ping; the script always exits 0, and its status is ignored anyway.
    spawnSync("pnpm", ["exec", "tsx", "scripts/submit-indexnow.ts"], { stdio: "inherit" });
  }
}

await main();
