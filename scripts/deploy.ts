import { spawnSync } from "node:child_process";

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const deploy = spawnSync("pnpm", ["exec", "wrangler", "deploy", ...args], {
    stdio: "inherit",
  });

  if (deploy.status !== 0) {
    process.exit(deploy.status ?? 1);
  }
}

await main();
