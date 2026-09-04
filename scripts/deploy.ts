import { spawnSync } from "node:child_process";

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
