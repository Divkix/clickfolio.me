/**
 * Safe production migration script
 *
 * Scans migration files for destructive SQL operations (DROP TABLE, DELETE, TRUNCATE)
 * and blocks execution unless --force is provided. Always creates a D1 export backup
 * before applying migrations.
 *
 * Usage:
 *   pnpm run db:migrate:prod              # Normal (blocks on destructive ops)
 *   pnpm run db:migrate:prod -- --force   # Bypass destructive check
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");
const DB_NAME = "clickfolio-db";
const DESTRUCTIVE_PATTERNS = [/DROP\s+TABLE/i, /DELETE\s+FROM/i, /TRUNCATE\s+TABLE/i];

const force = process.argv.includes("--force");

// --- Step 1: Scan migration files for destructive operations ---

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const destructiveFiles: { file: string; lines: string[] }[] = [];

for (const file of files) {
  const content = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const lines: string[] = [];
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    const linePattern = new RegExp(`.*${pattern.source}.*`, "gi");
    const matches = content.match(linePattern);
    if (matches) lines.push(...matches.map((m) => m.trim()));
  }
  if (lines.length > 0) {
    destructiveFiles.push({ file, lines });
  }
}

if (destructiveFiles.length > 0) {
  console.error("\n\x1b[33m-- DESTRUCTIVE OPERATIONS DETECTED --\x1b[0m\n");
  for (const { file, lines } of destructiveFiles) {
    console.error(`  ${file}`);
    for (const line of lines) {
      console.error(`    > ${line}`);
    }
  }
  console.error("");

  if (!force) {
    console.error("These migrations contain DROP TABLE / DELETE / TRUNCATE.");
    console.error("On D1, PRAGMA foreign_keys=OFF may NOT persist across statements,");
    console.error("causing ON DELETE CASCADE to fire and wipe related tables.\n");
    console.error("Review the SQL carefully, then re-run with --force:\n");
    console.error("  pnpm run db:migrate:prod -- --force\n");
    process.exit(1);
  }

  console.warn("\n\x1b[33m--force provided. Proceeding despite destructive operations.\x1b[0m\n");
}

// --- Step 2: Create D1 backup ---

const backupFile = `d1-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
console.log(`Creating D1 backup -> ${backupFile}`);
try {
  execSync(`wrangler d1 export ${DB_NAME} --remote --output=${backupFile}`, {
    stdio: "inherit",
  });
  console.log("Backup created.\n");
} catch (err) {
  console.error("Backup failed. Aborting migration.\n");
  console.error(err);
  process.exit(1);
}

// --- Step 3: Apply migrations ---

console.log("Applying migrations to production...");
try {
  execSync(`wrangler d1 migrations apply ${DB_NAME} --remote`, {
    stdio: "inherit",
  });
  console.log("\nProduction migrations applied successfully.");
} catch (err) {
  console.error("\nMigration failed.");
  console.error(err);
  process.exit(1);
}
