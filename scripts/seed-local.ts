import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { scryptAsync } from "@noble/hashes/scrypt";
import { bytesToHex } from "@noble/hashes/utils";

// Hash password using scrypt to match Better Auth's internal format
async function hashPassword(password: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384,
    p: 1,
    r: 16,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${bytesToHex(key)}`;
}

// Find local D1 SQLite file (same logic as drizzle.config.ts)
function getLocalD1Path(): string {
  const d1Dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  if (fs.existsSync(d1Dir)) {
    const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith(".sqlite"));
    if (files.length > 0) return path.join(d1Dir, files[0]);
  }
  throw new Error("Local D1 database not found. Run 'bun run db:migrate' first.");
}

async function seed() {
  const db = new Database(getLocalD1Path());
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const hashedPassword = await hashPassword("password");

  // Check if user already exists
  const existing = db.prepare("SELECT id FROM user WHERE email = ?").get("test@example.com");

  if (existing) {
    console.log("✓ User test@example.com already exists, skipping seed");
    db.close();
    process.exit(0);
  }

  // Insert user
  db.prepare(
    `
    INSERT INTO user (id, name, email, email_verified, created_at, updated_at,
      privacy_settings, onboarding_completed, is_pro, referral_count, is_admin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    userId,
    "Test User",
    "test@example.com",
    1,
    now,
    now,
    '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}',
    0,
    0,
    0,
    1, // isAdmin = true
  );

  // Insert account (credential provider)
  db.prepare(
    `
    INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(crypto.randomUUID(), userId, userId, "credential", hashedPassword, now, now);

  console.log("✓ Seeded user: test@example.com / password");
  db.close();
}

seed();
