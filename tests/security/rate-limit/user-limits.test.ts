import { Effect } from "effect";
import { sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { RateLimited } from "@/lib/effect/failures";
import { readQuotaIn, requireQuota } from "@/lib/rate-limit/user";
import { handleChanges, resumes, user } from "@/lib/db/schema";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const HOUR_MS = 60 * 60 * 1000;

let working: Awaited<ReturnType<typeof createTestDb>>;
let broken: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let brokenDb: TestDb;

beforeAll(async () => {
  working = await createTestDb();
  broken = await createTestDb();
  db = working.db;
  brokenDb = broken.db;
  await brokenDb.execute(sql`DROP TABLE handle_changes, resumes CASCADE`);
});

afterAll(async () => {
  await working.close();
  await broken.close();
});

beforeEach(async () => {
  await working.reset();
  await db.delete(handleChanges);

  const now = new Date().toISOString();

  await db.insert(user).values([
    { id: "u1", name: "U One", email: "u1@example.com", createdAt: now, updatedAt: now },
    { id: "u2", name: "U Two", email: "u2@example.com", createdAt: now, updatedAt: now },
  ]);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://clickfolio.me");
  vi.stubEnv("DISABLE_RATE_LIMITS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

let seq = 0;

async function seedHandleChanges(userId: string, ageMs: number, n: number) {
  const createdAt = new Date(Date.now() - ageMs).toISOString();

  await db.insert(handleChanges).values(
    Array.from({ length: n }, () => ({
      id: `hc-${seq++}`,
      userId,
      newHandle: `handle-${seq}`,
      createdAt,
    })),
  );
}

async function seedResumes(userId: string, ageMs: number, n: number) {
  const createdAt = new Date(Date.now() - ageMs).toISOString();

  await db
    .insert(resumes)
    .values(
      Array.from({ length: n }, () => ({ id: `r-${seq++}`, userId, r2Key: `k-${seq}`, createdAt })),
    );
}

type Action = "handle_change" | "resume_upload";

async function check(userId: string, action: Action, target = db) {
  return Effect.runPromise(requireQuota(await readQuotaIn(target, userId, action)));
}

async function refusal(userId: string, action: Action) {
  return Effect.runPromise(Effect.flip(requireQuota(await readQuotaIn(db, userId, action))));
}

describe("per-user limiter", () => {
  it("admits a user under the handle-change quota", async () => {
    await seedHandleChanges("u1", HOUR_MS, 2);

    await expect(check("u1", "handle_change")).resolves.toBeUndefined();
  });

  it("refuses the 4th handle change in 24 hours until the oldest one leaves the window", async () => {
    await seedHandleChanges("u1", 12 * HOUR_MS, 1);
    await seedHandleChanges("u1", HOUR_MS, 2);

    const refused = await refusal("u1", "handle_change");

    expect(refused).toBeInstanceOf(RateLimited);
    expect(refused).toMatchObject({ message: expect.stringContaining("Maximum 3 handle change") });
    // Oldest change was 12 h ago, so it frees up in about 12 h.
    expect(Math.abs(refused.retryAfterSeconds - 12 * 3600)).toBeLessThan(5);
  });

  it("refuses the 6th resume upload in 24 hours and ignores older uploads and other users", async () => {
    await seedResumes("u1", 25 * HOUR_MS, 10);
    await seedResumes("u2", HOUR_MS, 5);
    await seedResumes("u1", HOUR_MS, 4);

    await expect(check("u1", "resume_upload")).resolves.toBeUndefined();

    await seedResumes("u1", HOUR_MS, 1);

    expect(await refusal("u1", "resume_upload")).toBeInstanceOf(RateLimited);
  });

  it("fails closed when the store is down", async () => {
    await expect(check("u1", "resume_upload", brokenDb)).rejects.toThrow();
  });

  it("skips the store outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(check("u1", "resume_upload", brokenDb)).resolves.toBeUndefined();
  });

  it("ignores DISABLE_RATE_LIMITS in production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubEnv("DISABLE_RATE_LIMITS", "true");
    await seedHandleChanges("u1", HOUR_MS, 3);

    expect(await refusal("u1", "handle_change")).toBeInstanceOf(RateLimited);
    expect(logLines(warn)[0]).toMatchObject({ level: "warn" });
  });
});
