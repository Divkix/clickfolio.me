import { spawnSync } from "node:child_process";

// Replaces the old 2am temp/ sweep: R2 expires anonymous uploads itself. `lifecycle set`
// overwrites every rule on the bucket, so r2-lifecycle.json lists all of them.
const R2_BUCKET = "clickfolio-bucket";

const R2_LIFECYCLE_FILE = "r2-lifecycle.json";

// updated_at comes from Worker clocks, not this machine's, so the post-deploy pass looks back
// further than the pre-deploy pass started. Recomputing a few extra rows is harmless.
const CLOCK_SKEW_MARGIN_MS = 60 * 60 * 1000;

/** Fills site_data.content_indexable (NULL rows, plus rows updated since `since`). Needs DATABASE_URL. */
function backfillContentIndexable(since?: string): void {
  const backfill = spawnSync(
    "pnpm",
    ["run", "db:backfill-indexable", ...(since ? ["--since", since] : [])],
    { stdio: "inherit" },
  );

  if (backfill.status !== 0) {
    process.exit(backfill.status ?? 1);
  }
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const dryRun = args.includes("--dry-run");
  const backfillSince = new Date(Date.now() - CLOCK_SKEW_MARGIN_MS).toISOString();

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

    // The new Worker filters on content_indexable, so it must be filled before that code goes live.
    backfillContentIndexable();

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
    // The old Worker kept rewriting content without touching the flag until the deploy above, so
    // flags set by the first pass can be stale: recompute every row changed since it started.
    backfillContentIndexable(backfillSince);

    // Best-effort search-engine ping; the script always exits 0, and its status is ignored anyway.
    spawnSync("pnpm", ["exec", "tsx", "scripts/submit-indexnow.ts"], { stdio: "inherit" });
  }
}

await main();
