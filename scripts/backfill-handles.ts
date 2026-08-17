#!/usr/bin/env tsx
/**
 * Backfill missing handles for users with handle IS NULL.
 *
 * Atomically sets handle + onboarding_completed=1 + updated_at=ISO
 * guarded by WHERE handle IS NULL for idempotency.
 *
 * Site-data: does NOT create fake site_data rows. 7 of 15 null-handle
 * users already have site_data (will become public once handle assigned);
 * 8 without remain 404 until upload — correct.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-handles.ts --dry-run
 *   pnpm exec tsx scripts/backfill-handles.ts --dry-run --out=backfill.sql
 *   pnpm exec tsx scripts/backfill-handles.ts --execute
 *   pnpm exec tsx scripts/backfill-handles.ts --execute --out=backfill.sql
 *
 * Flags:
 *   --dry-run   (default) print table + SQL without writing
 *   --execute   run wrangler d1 execute --remote updates sequentially
 *   --out=FILE  also write SQL statements to FILE
 *   --help      show help
 *
 * Handles:
 *   - sanitization mirrors components/wizard/HandleStep.tsx handleChange
 *     but per spec replaces [^a-z0-9-] with "-" (spec wording) then
 *     collapses -+, trims, slices 30.
 *   - candidate order: sanitize(name) if >=3 else sanitize(email prefix) else fallback user-${id.slice(0,8)}
 *   - validation via handleSchema.safeParse + reserved + dot check
 *   - uniqueness via makeUnique suffix -2,-3 with re-truncation to 30
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { handleSchema } from "@/lib/schemas/profile";

// Inline RESERVED_HANDLES to avoid importing @/lib/rate-limit/handle-validation
// which pulls drizzle-orm DB deps at import time.
// Must mirror lib/rate-limit/handle-validation.ts RESERVED_HANDLES; sync enforced by test __tests__/unit/lib/backfill-reserved-sync.test.ts
const RESERVED_HANDLES = new Set<string>(["api", "_next", "static", "public", "xmlrpc", "adminer"]);

const DB_NAME = "clickfolio-db";

// ---------------------------------------------------------------------------
// Exported helpers — shared contract, used by tests and main
// ---------------------------------------------------------------------------

/**
 * Mirrors HandleStep handleChange + spec sanitizeHandle contract:
 * lower, replace [^a-z0-9-] -> '-', collapse -+, trim ^-+|-+$, slice 0,30
 * Second trim after slice is needed because truncation can introduce a trailing
 * hyphen — e.g., sanitizeHandle("a".repeat(29) + "-b") would first trim to
 * "a...a-b" then slice 30 -> "a...a-" which would fail handleSchema without
 * re-trimming. The trailing `replace(/^-+|-+$/g, "")` after slice fixes this.
 */
export function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/^-+|-+$/g, "");
}

export function isReserved(handle: string): boolean {
  if (handle.includes(".")) return true;
  return RESERVED_HANDLES.has(handle.toLowerCase());
}

/**
 * Candidate generation order:
 *  try sanitize(name) if name && length>=3 after sanitize,
 *  else sanitize(email prefix before @),
 *  else fallback `user-${id.slice(0,8).toLowerCase()}`
 * If candidate invalid (handleSchema fail or reserved or .includes) fallback.
 */
export function generateCandidate(name: string | null, email: string, id: string): string {
  const fallback = `user-${id.slice(0, 8).toLowerCase()}`;

  if (name) {
    const s = sanitizeHandle(name);
    if (s.length >= 3 && !isReserved(s) && handleSchema.safeParse(s).success) {
      return s;
    }
  }

  const prefix = (email.split("@")[0] ?? "").trim();
  const s2 = sanitizeHandle(prefix);
  if (s2.length >= 3 && !isReserved(s2) && handleSchema.safeParse(s2).success) {
    return s2;
  }

  return fallback;
}

/**
 * Ensure uniqueness against live handles + batch-generated handles.
 * If base not in taken and valid then return base else loop suffix -2,-3
 * truncating base to fit 30.
 */
export function makeUnique(base: string, taken: Set<string>): string {
  const lowerTaken = new Set<string>([...taken].map((h) => h.toLowerCase()));

  if (
    !lowerTaken.has(base.toLowerCase()) &&
    !isReserved(base) &&
    handleSchema.safeParse(base).success
  ) {
    return base;
  }

  for (let i = 2; i < 10000; i++) {
    const suffix = `-${i}`;
    const maxBaseLen = 30 - suffix.length;
    let truncated = base.slice(0, maxBaseLen).replace(/-+$/g, "");
    // Edge: truncated became empty after trimming (e.g., base="---")
    if (truncated.length === 0) {
      truncated = base
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, Math.max(1, maxBaseLen - 1));
      if (truncated.length === 0) truncated = "user";
      truncated = truncated.slice(0, maxBaseLen).replace(/-+$/g, "");
    }
    const candidate = `${truncated}${suffix}`;
    if (candidate.length < 3) continue;
    if (isReserved(candidate)) continue;
    if (!handleSchema.safeParse(candidate).success) continue;
    if (!lowerTaken.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error(`makeUnique: exhausted suffixes for base "${base}"`);
}

// ---------------------------------------------------------------------------
// Wrangler helpers
// ---------------------------------------------------------------------------

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function extractJsonFromOutput(output: string): unknown {
  const trimmed = output.trim();
  // Direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallthrough: try to locate JSON array/object substring
  }

  const firstBracket = trimmed.indexOf("[");
  const firstBrace = trimmed.indexOf("{");
  let start = -1;
  if (firstBracket === -1) start = firstBrace;
  else if (firstBrace === -1) start = firstBracket;
  else start = Math.min(firstBracket, firstBrace);

  if (start === -1) throw new Error("No JSON found in wrangler output");

  // Try array first, then object
  const candidates: string[] = [];
  const lastBracket = trimmed.lastIndexOf("]");
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBracket !== -1 && lastBracket > start) {
    candidates.push(trimmed.slice(start, lastBracket + 1));
  }
  if (lastBrace !== -1 && lastBrace > start) {
    candidates.push(trimmed.slice(start, lastBrace + 1));
  }

  for (const cand of candidates) {
    try {
      return JSON.parse(cand);
    } catch {
      // try next
    }
  }
  throw new Error("Failed to parse wrangler JSON output");
}

function extractRows(parsed: unknown): Record<string, unknown>[] {
  // Wrangler --json returns: [{ results: [...], success: true, meta: {...} }, ...]
  if (Array.isArray(parsed)) {
    const out: Record<string, unknown>[] = [];
    for (const entry of parsed) {
      if (entry !== null && typeof entry === "object" && "results" in entry) {
        const r = entry.results;
        if (Array.isArray(r)) {
          for (const row of r) {
            if (row !== null && typeof row === "object") {
              out.push(row as Record<string, unknown>);
            }
          }
        }
      }
    }
    // If no .results found but array itself looks like rows, return it
    if (
      out.length === 0 &&
      parsed.length > 0 &&
      typeof parsed[0] === "object" &&
      parsed[0] !== null
    ) {
      const first = parsed[0] as Record<string, unknown>;
      if ("id" in first || "email" in first || "handle" in first) {
        const rows: Record<string, unknown>[] = [];
        for (const row of parsed) {
          if (row !== null && typeof row === "object") rows.push(row as Record<string, unknown>);
        }
        return rows;
      }
    }
    return out;
  }
  if (parsed !== null && typeof parsed === "object" && "results" in parsed) {
    const r = parsed.results;
    if (Array.isArray(r)) {
      const rows: Record<string, unknown>[] = [];
      for (const row of r) {
        if (row !== null && typeof row === "object") rows.push(row as Record<string, unknown>);
      }
      return rows;
    }
  }
  if (parsed !== null && typeof parsed === "object" && "rows" in parsed) {
    const r = parsed.rows;
    if (Array.isArray(r)) {
      const rows: Record<string, unknown>[] = [];
      for (const row of r) {
        if (row !== null && typeof row === "object") rows.push(row as Record<string, unknown>);
      }
      return rows;
    }
  }
  return [];
}

function runWranglerJson(sql: string): Record<string, unknown>[] {
  // Use spawnSync("pnpm", ["exec","wrangler",...]) to avoid shell quoting
  const res = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", DB_NAME, "--remote", "--json", "--command", sql],
    {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    const stderr = (res.stderr ?? "").toString().slice(0, 2000);
    const stdout = (res.stdout ?? "").toString().slice(0, 2000);
    throw new Error(`wrangler failed (status ${res.status}): ${stderr || stdout}`);
  }

  const stdout = (res.stdout ?? "").toString();
  if (!stdout.trim()) return [];
  const parsed = extractJsonFromOutput(stdout);
  return extractRows(parsed);
}

// ---------------------------------------------------------------------------
// Data fetching (live D1) with offline fallback for dry-run
// ---------------------------------------------------------------------------

interface NullUserRow {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
}

function fetchNullUsersLive(): NullUserRow[] {
  const rows = runWranglerJson(
    "SELECT id, email, name, handle FROM user WHERE handle IS NULL ORDER BY created_at DESC",
  );
  return rows.map((r) => ({
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    email: typeof r.email === "string" ? r.email : String(r.email ?? ""),
    name: typeof r.name === "string" ? r.name : null,
    handle: typeof r.handle === "string" ? r.handle : null,
  }));
}

function fetchTakenHandlesLive(): Set<string> {
  const rows = runWranglerJson("SELECT handle FROM user WHERE handle IS NOT NULL");
  const s = new Set<string>();
  for (const r of rows) {
    const h = r.handle;
    if (typeof h === "string" && h.length > 0) s.add(h);
  }
  return s;
}

// Fallback mock data for offline dry-run (matches live 15 observed by D1RemoteProbe + DryRunPreviewProbe)
// IDs distinct in first 8 chars so fallback user-XXXXXXXX are unique if needed.
// Names mirror live D1 to produce identical candidate handles as live preview:
//  live handles via sanitize(name) -> preview list ASC: himanshu-maurya, md-yunus, juner-way, expocity-tiktok, your-marketing-solutions, mecisaigon-ngoctb, sowmiya-k, asish-v, abdullah-khan, groza-dmc, vishal-m-23chr052, prem-anand, julian-moreno, rayudu-allavarapu, asmita
// We store DESC order (newest first) as live query does ORDER BY created_at DESC.
const MOCK_NULL_USERS: NullUserRow[] = [
  {
    id: "11111111-1111-4000-8000-000000000001",
    email: "rsasmitapatil@gmail.com",
    name: "Asmita",
    handle: null,
  },
  {
    id: "22222222-2222-4000-8000-000000000002",
    email: "allavarapurayudu@gmail.com",
    name: "Rayudu Allavarapu",
    handle: null,
  },
  {
    id: "33333333-3333-4000-8000-000000000003",
    email: "julian.moreno@mozartai.com.co",
    name: "Julian Moreno",
    handle: null,
  },
  {
    id: "44444444-4444-4000-8000-000000000004",
    email: "pradhiksha9234@gmail.com",
    name: "Prem Anand",
    handle: null,
  },
  {
    id: "55555555-5555-4000-8000-000000000005",
    email: "vishalm.23chem@kongu.edu",
    name: "Vishal M 23chr052",
    handle: null,
  },
  {
    id: "66666666-6666-4000-8000-000000000006",
    email: "sbdr1234567@gmail.com",
    name: "GROZA DMC",
    handle: null,
  },
  {
    id: "77777777-7777-4000-8000-000000000007",
    email: "abdullahkhan0854563@gmail.com",
    name: "Abdullah Khan",
    handle: null,
  },
  {
    id: "88888888-8888-4000-8000-000000000008",
    email: "asishvijayan2004@gmail.com",
    name: "Asish V",
    handle: null,
  },
  {
    id: "99999999-9999-4000-8000-000000000009",
    email: "sowmiya.cse@uit.ac.in",
    name: "Sowmiya K",
    handle: null,
  },
  {
    id: "aaaaaaaa-aaaa-4000-8000-000000000010",
    email: "ngoctb.mecisaigon@gmail.com",
    name: "Mecisaigon Ngoctb",
    handle: null,
  },
  {
    id: "bbbbbbbb-bbbb-4000-8000-000000000011",
    email: "yourmarketingsolution5k@gmail.com",
    name: "Your Marketing Solutions",
    handle: null,
  },
  {
    id: "cccccccc-cccc-4000-8000-000000000012",
    email: "expocitytiktok@gmail.com",
    name: "Expocity Tiktok",
    handle: null,
  },
  {
    id: "dddddddd-dddd-4000-8000-000000000013",
    email: "junerway.msg@gmail.com",
    name: "JuneR Way",
    handle: null,
  },
  {
    id: "eeeeeeee-eeee-4000-8000-000000000014",
    email: "2022010003543@gndu.ac.in",
    name: "Md Yunus",
    handle: null,
  },
  {
    id: "ffffffff-ffff-4000-8000-000000000015",
    email: "mhimanshu.338@gmail.com",
    name: "Himanshu Maurya",
    handle: null,
  },
];

const MOCK_TAKEN_HANDLES = new Set<string>([
  // 26 distinct existing handles — avoid collision with mock null candidates
  "alice-smith",
  "bob-jones",
  "charlie-brown",
  "david-wilson",
  "emma-davis",
  "frank-miller",
  "grace-lee",
  "henry-taylor",
  "isabella-moore",
  "jack-anderson",
  "kate-thomas",
  "liam-jackson",
  "mia-white",
  "noah-harris",
  "olivia-martin",
  "peter-thompson",
  "quinn-garcia",
  "rachel-martinez",
  "sam-robinson",
  "tina-clark",
  "uma-rodriguez",
  "victor-lewis",
  "wendy-walker",
  "xavier-hall",
  "yvonne-allen",
  "zachary-young",
]);

// ---------------------------------------------------------------------------
// Mapping generation
// ---------------------------------------------------------------------------

interface Mapping {
  id: string;
  email: string;
  name: string | null;
  handle: string;
  sql: string;
}

function buildMappings(nullUsers: NullUserRow[], taken: Set<string>, nowIso: string): Mapping[] {
  const takenMutable = new Set<string>(taken);
  const mappings: Mapping[] = [];

  for (const u of nullUsers) {
    const base = generateCandidate(u.name, u.email, u.id);
    const unique = makeUnique(base, takenMutable);
    takenMutable.add(unique);
    const sql = `UPDATE user SET handle='${escapeSql(unique)}', onboarding_completed=1, updated_at='${escapeSql(nowIso)}' WHERE id='${escapeSql(u.id)}' AND handle IS NULL;`;
    mappings.push({ id: u.id, email: u.email, name: u.name, handle: unique, sql });
  }

  return mappings;
}

function validateMappings(mappings: Mapping[], taken: Set<string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>([...taken].map((h) => h.toLowerCase()));
  for (const m of mappings) {
    const lower = m.handle.toLowerCase();
    if (seen.has(lower)) {
      errors.push(`${m.email} -> ${m.handle}: collides with existing handle`);
    } else {
      seen.add(lower);
    }
    const parsed = handleSchema.safeParse(m.handle);
    if (!parsed.success) {
      errors.push(
        `${m.email} -> ${m.handle}: handleSchema failed: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    if (isReserved(m.handle)) {
      errors.push(`${m.email} -> ${m.handle}: reserved or contains dot`);
    }
    if (m.handle.length < 3 || m.handle.length > 30) {
      errors.push(`${m.email} -> ${m.handle}: length ${m.handle.length} out of bounds`);
    }
    if (!m.sql.includes("handle IS NULL")) {
      errors.push(`${m.email}: SQL missing handle IS NULL guard`);
    }
  }
  // Check uniqueness within batch
  const batchSet = new Set<string>();
  for (const m of mappings) {
    const l = m.handle.toLowerCase();
    if (batchSet.has(l)) errors.push(`duplicate handle in batch: ${m.handle}`);
    batchSet.add(l);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
Backfill handles for users with handle IS NULL

Usage:
  pnpm exec tsx scripts/backfill-handles.ts [--dry-run] [--execute] [--out=FILE]

Options:
  --dry-run       Print mapping table + SQL without writing (default)
  --execute       Execute UPDATEs via wrangler d1 execute --remote
  --out=FILE      Also write SQL statements to FILE
  --help          Show this help

Examples:
  pnpm exec tsx scripts/backfill-handles.ts --dry-run
  pnpm exec tsx scripts/backfill-handles.ts --dry-run --out=backfill.sql
  pnpm exec tsx scripts/backfill-handles.ts --execute
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const isExecute = args.includes("--execute");
  const isDryRun = !isExecute;
  const outArg = args.find((a) => a.startsWith("--out="));
  const outFile = outArg
    ? outArg.slice("--out=".length)
    : args.includes("--out")
      ? args[args.indexOf("--out") + 1]
      : undefined;

  // Support --out FILE syntax
  let outPath: string | undefined = outFile;
  if (!outPath && args.includes("--out")) {
    const idx = args.indexOf("--out");
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
      outPath = args[idx + 1];
    }
  }

  const nowIso = new Date().toISOString();

  // Fetch live data
  let nullUsers: NullUserRow[] | null = null;
  let taken: Set<string> | null = null;
  let usedMock = false;

  try {
    nullUsers = fetchNullUsersLive();
    taken = fetchTakenHandlesLive();
    console.log(
      `Fetched ${nullUsers.length} null-handle users and ${taken.size} taken handles from live D1 (${DB_NAME})`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isDryRun) {
      console.warn(
        `\n⚠ Live D1 fetch failed (${msg}) — falling back to mock data for dry-run preview.\n  To use live data, ensure wrangler is logged in and CLOUDFLARE_API_TOKEN is set.\n`,
      );
      nullUsers = MOCK_NULL_USERS;
      taken = new Set<string>(MOCK_TAKEN_HANDLES);
      usedMock = true;
    } else {
      console.error(`\n✖ Live D1 fetch failed: ${msg}`);
      console.error("Aborting --execute. Fix wrangler auth (wrangler login) and retry.");
      process.exit(1);
    }
  }

  // Definite after above
  const users = nullUsers!;
  const takenHandles = taken!;

  if (users.length === 0) {
    console.log("No users with handle IS NULL — nothing to backfill.");
    process.exit(0);
  }

  const mappings = buildMappings(users, takenHandles, nowIso);
  const validationErrors = validateMappings(mappings, takenHandles);

  // Print table
  console.log("\n" + "=".repeat(96));
  console.log(
    `Backfill preview — ${usedMock ? "MOCK PREVIEW (no live D1)" : "LIVE D1"} — ${nowIso}`,
  );
  console.log("=".repeat(96));
  console.log(
    `Null users: ${users.length} | Taken handles: ${takenHandles.size} | Mode: ${isDryRun ? "dry-run" : "execute"}`,
  );
  console.log("-".repeat(96));

  // Header
  const colEmail = 38;
  const colHandle = 30;
  const colId = 10;

  // Compute dynamic table lines
  const header = `${"email".padEnd(colEmail)} | ${"candidate handle".padEnd(colHandle)} | ${"id (prefix)".padEnd(colId)} | name`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (const m of mappings) {
    const emailCell =
      m.email.length > colEmail - 1
        ? m.email.slice(0, colEmail - 4) + "..."
        : m.email.padEnd(colEmail);
    const handleCell = m.handle.padEnd(colHandle);
    const idCell = m.id.slice(0, 8).padEnd(colId);
    const nameCell = m.name ?? "";
    console.log(`${emailCell} | ${handleCell} | ${idCell} | ${nameCell}`);
  }

  console.log("-".repeat(header.length));

  if (validationErrors.length > 0) {
    console.error("\n✖ Validation errors:");
    for (const e of validationErrors) console.error(`  - ${e}`);
    process.exit(1);
  } else {
    console.log("\n✓ All handles pass handleSchema, not reserved, unique (including batch).");
  }

  console.log("\nGenerated SQL (guarded with handle IS NULL):");
  console.log("-".repeat(96));
  for (const m of mappings) {
    console.log(m.sql);
  }
  console.log("-".repeat(96));

  // Also generate site_data publish SQL for existing rows where last_published_at IS NULL
  // This ensures the 7 of 15 null-handle users who already have site_data become public.
  // Dry-run should show this SQL; execute will run it best-effort per successful user.
  const siteDataSqls = mappings.map(
    (m) =>
      `UPDATE site_data SET last_published_at='${escapeSql(nowIso)}', updated_at='${escapeSql(nowIso)}' WHERE user_id='${escapeSql(m.id)}' AND last_published_at IS NULL;`,
  );
  console.log(
    "\nGenerated site_data publish SQL (only updates existing rows where last_published_at IS NULL):",
  );
  console.log("-".repeat(96));
  for (const s of siteDataSqls) {
    console.log(s);
  }
  console.log("-".repeat(96));

  // Also verify SQL guards
  const unguarded = mappings.filter((m) => !m.sql.includes("handle IS NULL"));
  if (unguarded.length > 0) {
    console.error("SQL guard check failed — missing handle IS NULL");
    process.exit(1);
  }

  const jsonSummary = {
    mode: isDryRun ? "dry-run" : "execute",
    source: usedMock ? "mock" : "live",
    timestamp: nowIso,
    nullCount: users.length,
    takenCount: takenHandles.size,
    mappings: mappings.map((m) => ({ id: m.id, email: m.email, handle: m.handle })),
    sql: mappings.map((m) => m.sql),
    siteDataSql: siteDataSqls,
    validation: validationErrors.length === 0 ? "ok" : validationErrors,
  };

  console.log("\nJSON summary:");
  console.log(JSON.stringify(jsonSummary, null, 2));

  if (outPath) {
    const sqlContent =
      mappings.map((m) => m.sql).join("\n") + "\n" + siteDataSqls.join("\n") + "\n";
    writeFileSync(outPath, sqlContent, "utf-8");
    console.log(
      `\n✓ SQL written to ${outPath} (${mappings.length} user + ${siteDataSqls.length} site_data statements)`,
    );
  }

  if (isDryRun) {
    console.log(
      `\nDry-run complete — ${mappings.length} UPDATE statements generated, no writes performed.`,
    );
    console.log(`To execute, re-run with --execute`);
    if (usedMock) {
      console.log(`Note: used mock data; re-run with live D1 for production backfill.`);
    }
    // Ensure exit 0
    return;
  }

  // Execute mode — run each UPDATE via wrangler sequentially
  console.log(`\nExecuting ${mappings.length} UPDATEs via wrangler d1 execute --remote ...`);
  let successCount = 0;
  let failCount = 0;
  const failures: Array<{ email: string; id: string; handle: string; error: string }> = [];

  for (const m of mappings) {
    // Use individual UPDATE (guarded) — single statement per wrangler call
    // Wrangler expects --command "<SQL>"
    const updateSql = m.sql; // already includes guard
    const res = spawnSync(
      "pnpm",
      ["exec", "wrangler", "d1", "execute", DB_NAME, "--remote", "--command", updateSql],
      {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (res.error || res.status !== 0) {
      const errMsg = res.error
        ? res.error.message
        : (res.stderr ?? res.stdout ?? "").toString().slice(0, 2000) || `exit ${res.status}`;
      console.error(`✖ Failed ${m.email} (${m.id.slice(0, 8)}) -> ${m.handle}: ${errMsg}`);
      failures.push({ email: m.email, id: m.id, handle: m.handle, error: errMsg });
      failCount++;
    } else {
      // Check for success via output meta if available, but status 0 is enough for D1
      console.log(`✓ ${m.email} -> ${m.handle}`);
      successCount++;
    }
  }

  console.log("\n" + "=".repeat(96));
  console.log(
    `Execute summary: ${successCount} succeeded, ${failCount} failed / ${mappings.length} total`,
  );
  if (failures.length > 0) {
    console.log(JSON.stringify({ successCount, failCount, failures }, null, 2));
    console.error(
      "\n✖ Some updates failed — review wrangler output above. Re-run is safe (idempotent WHERE handle IS NULL).",
    );
    process.exit(1);
  }

  // Publish existing site_data rows that already exist but have last_published_at IS NULL.
  // Due to the new handle gate, 7 of the 15 null-handle users already have site_data
  // with last_published_at = NULL — they should become public once handle is assigned.
  // This is best-effort per user (0 rows affected is fine if no site_data row exists).
  const successfulMappings = mappings.filter((m) => !failures.some((f) => f.id === m.id));
  if (successfulMappings.length > 0) {
    console.log(
      `\nPublishing site_data for ${successfulMappings.length} users where last_published_at IS NULL ...`,
    );
    for (const m of successfulMappings) {
      const siteDataSql = `UPDATE site_data SET last_published_at='${escapeSql(nowIso)}', updated_at='${escapeSql(nowIso)}' WHERE user_id='${escapeSql(m.id)}' AND last_published_at IS NULL`;
      try {
        runWranglerJson(siteDataSql);
        console.log(`✓ site_data published for ${m.email} (${m.id.slice(0, 8)}) if existed`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `⚠ site_data publish failed for ${m.email} (${m.id.slice(0, 8)}): ${msg} — continuing`,
        );
      }
    }
  }

  // Verification: re-query null count
  try {
    const remainingRows = runWranglerJson("SELECT COUNT(*) as cnt FROM user WHERE handle IS NULL");
    let cnt: number | string = "unknown";
    if (remainingRows.length > 0) {
      const first = remainingRows[0];
      if (first !== null && typeof first === "object" && "cnt" in first) {
        const c = first.cnt;
        if (typeof c === "number") cnt = c;
        else if (typeof c === "string") cnt = Number.parseInt(c, 10);
      }
    }
    console.log(`Verification: remaining users with handle IS NULL: ${cnt}`);
  } catch {
    console.warn(
      "Verification query failed — check manually: SELECT COUNT(*) FROM user WHERE handle IS NULL",
    );
  }

  console.log("\n✓ Backfill complete.");
}

// Only run main when executed directly (not when imported for tests)
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("backfill-handles.ts") ||
    process.argv[1].endsWith("backfill-handles.js"));

if (isDirectRun) {
  void main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
