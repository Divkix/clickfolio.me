import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { routesForChangedFiles } from "../lib/seo/lastmod";

// Pre-commit hook: stamps today's date on every static sitemap route whose sources are staged,
// then re-stages lastmod.json. Set SKIP_LASTMOD=1 for commits that change no page content
// (formatting, refactors) so crawlers are not told the page changed.
const LASTMOD_FILE = join(import.meta.dirname, "..", "lib", "seo", "lastmod.json");

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

export async function main(): Promise<void> {
  if (process.env.SKIP_LASTMOD === "1") return;

  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMRD", "-z"])
    .split("\0")
    .filter(Boolean);

  const lastmod: Record<string, string> = JSON.parse(await readFile(LASTMOD_FILE, "utf8"));
  const date = today();

  const bumped = routesForChangedFiles(staged, Object.keys(lastmod)).filter(
    (route) => lastmod[route] !== date,
  );

  if (bumped.length === 0) return;

  for (const route of bumped) lastmod[route] = date;

  await writeFile(LASTMOD_FILE, `${JSON.stringify(lastmod, null, 2)}\n`);
  git(["add", LASTMOD_FILE]);
  console.log(`lastmod: ${bumped.join(", ")} → ${date}`);
}

await main();
