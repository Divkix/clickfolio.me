export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const deploy = Bun.spawnSync(["bunx", "wrangler", "deploy", ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (deploy.exitCode !== 0) {
    process.exit(deploy.exitCode ?? 1);
  }
}

await main();
