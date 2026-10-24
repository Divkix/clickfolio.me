import { Effect } from "effect";
import { and, count, eq, sql } from "drizzle-orm";
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
import { Db } from "@/lib/effect/db";
import { RateLimited, RateLimitUnavailable } from "@/lib/effect/failures";
import { rateLimitLocks, uploadRateLimits } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/utils/hash";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const HOUR_MS = 60 * 60 * 1000;

const IP = "203.0.113.7";

let working: Awaited<ReturnType<typeof createTestDb>>;
let broken: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let brokenDb: TestDb;

beforeAll(async () => {
  working = await createTestDb();
  broken = await createTestDb();
  db = working.db;
  brokenDb = broken.db;
  await brokenDb.execute(sql`DROP TABLE upload_rate_limits`);
});

afterAll(async () => {
  await working.close();
  await broken.close();
});

beforeEach(async () => {
  await db.delete(uploadRateLimits);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://clickfolio.me");
  vi.stubEnv("DISABLE_RATE_LIMITS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function seed(ip: string, actionType: "upload" | "handle_check", ageMs: number, n: number) {
  const ipHash = await sha256Hex(new TextEncoder().encode(ip));
  const createdAt = new Date(Date.now() - ageMs).toISOString();
  const expiresAt = new Date(Date.now() + HOUR_MS).toISOString();

  await db.insert(uploadRateLimits).values(
    Array.from({ length: n }, (_, i) => ({
      id: `seed-${actionType}-${ageMs}-${i}-${ip}`,
      ipHash,
      actionType,
      createdAt,
      expiresAt,
    })),
  );
}

async function rowCount(ip: string, actionType: "upload" | "handle_check") {
  const ipHash = await sha256Hex(new TextEncoder().encode(ip));

  const [row] = await db
    .select({ n: count() })
    .from(uploadRateLimits)
    .where(and(eq(uploadRateLimits.ipHash, ipHash), eq(uploadRateLimits.actionType, actionType)));

  return row?.n ?? 0;
}

function run<A, E>(program: Effect.Effect<A, E, Db>, target: TestDb = db) {
  return Effect.runPromise(Effect.provide(program, Db.layerFrom(target)));
}

function fail<A, E>(program: Effect.Effect<A, E, Db>, target: TestDb = db) {
  return run(Effect.flip(program), target);
}

describe("upload limiter (Effect)", () => {
  it("admits a request under the limit and records it", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    const admitted = await run(checkIPRateLimitEffect(IP));

    expect(admitted.remaining).toEqual({ hourly: 9, daily: 49 });
    expect(await rowCount(IP, "upload")).toBe(1);
  });

  it("refuses the 11th request in an hour until the oldest of the ten expires", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 5 * 60 * 1000, 10);
    const refusal = await fail(checkIPRateLimitEffect(IP));

    expect(refusal).toBeInstanceOf(RateLimited);
    expect(refusal).toMatchObject({ message: expect.stringContaining("Limit: 10/hour") });
    // 5 minutes into the window, so a slot frees in 55 minutes — not the full hour.
    expect(Math.abs(refusal.retryAfterSeconds - 55 * 60)).toBeLessThan(5);
    expect(await rowCount(IP, "upload")).toBe(10);
  });

  it("refuses at 50 a day until the oldest daily row expires, even when the hour is clear", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 5 * HOUR_MS, 50);
    const refusal = await fail(checkIPRateLimitEffect(IP));

    expect(refusal).toMatchObject({ message: expect.stringContaining("Limit: 50/day") });
    // 5 hours into the day window, so a slot frees in 19 hours — not the full day.
    expect(Math.abs(refusal.retryAfterSeconds - 19 * 3600)).toBeLessThan(5);
  });

  // Both windows full: nothing is admitted until both have freed a slot, so the window that
  // frees last sets the wait and the message.
  it.each([
    ["the day frees last", 5 * HOUR_MS, "Limit: 50/day", 19 * 3600],
    ["the hour frees last", 24 * HOUR_MS - 5 * 60 * 1000, "Limit: 10/hour", 55 * 60],
  ])("waits for the later window when both are full and %s", async (_label, ageOfDay, message, wait) => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", ageOfDay, 40);
    await seed(IP, "upload", 5 * 60 * 1000, 10);
    const refusal = await fail(checkIPRateLimitEffect(IP));

    expect(refusal).toMatchObject({ message: expect.stringContaining(message) });
    expect(Math.abs(refusal.retryAfterSeconds - wait)).toBeLessThan(5);
  });

  it("ignores rows older than the windows", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 25 * HOUR_MS, 60);
    await seed(IP, "upload", 2 * HOUR_MS, 9);

    const admitted = await run(checkIPRateLimitEffect(IP));

    expect(admitted.remaining.hourly).toBe(9);
    expect(admitted.remaining.daily).toBe(50 - 10);
  });

  it("meters addresses and actions independently", async () => {
    const { checkIPRateLimitEffect, checkHandleRateLimitEffect } =
      await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 1000, 10);
    await seed(IP, "handle_check", 1000, 100);

    const other = await run(checkIPRateLimitEffect("203.0.113.8"));

    expect(other.remaining.hourly).toBe(9);
    expect(await fail(checkIPRateLimitEffect(IP))).toBeInstanceOf(RateLimited);
    expect(await fail(checkHandleRateLimitEffect(IP))).toBeInstanceOf(RateLimited);
    expect(await rowCount(IP, "upload")).toBe(10);
  });

  it("keeps one shared, metered bucket for requests without a known address", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed("unknown", "upload", 1000, 10);

    expect(await fail(checkIPRateLimitEffect("unknown"))).toBeInstanceOf(RateLimited);
  });

  it("stores only a hash of the address and the row expiry matches the window", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await run(checkIPRateLimitEffect(IP));
    const [row] = await db.select().from(uploadRateLimits);

    expect(JSON.stringify(row)).not.toContain(IP);
    expect(new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime()).toBe(
      24 * HOUR_MS,
    );
  });

  // PGlite serializes transactions on one connection, so this cannot prove the row lock blocks
  // concurrent transactions; it pins the count-then-insert arithmetic under a burst.
  it("admits exactly the limit from a burst of 15 simultaneous requests", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    const outcomes = await Promise.all(
      Array.from({ length: 15 }, () =>
        run(
          checkIPRateLimitEffect(IP).pipe(
            Effect.match({ onSuccess: () => true, onFailure: () => false }),
          ),
        ),
      ),
    );

    const admitted = outcomes.filter(Boolean);

    expect(admitted).toHaveLength(10);
    expect(await rowCount(IP, "upload")).toBe(10);
  });

  it("refuses with RateLimitUnavailable and logs when the store is down", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const refusal = await fail(checkIPRateLimitEffect(IP), brokenDb);

    expect(refusal).toBeInstanceOf(RateLimitUnavailable);
    expect(refusal).toMatchObject({ retryAfterSeconds: 60 });

    const [line] = logLines(error);

    expect(line).toMatchObject({
      level: "error",
      msg: "Rate limit store failed",
      limiter: "upload",
    });
    expect(JSON.stringify(line)).not.toContain(IP);
  });

  it("skips the store outside production", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    vi.stubEnv("NODE_ENV", "development");

    const admitted = await run(checkIPRateLimitEffect(IP), brokenDb);

    expect(admitted.remaining).toEqual({ hourly: 10, daily: 50 });
  });

  it("skips the store for loopback addresses", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    expect((await run(checkIPRateLimitEffect("127.0.0.1"), brokenDb)).remaining.hourly).toBe(10);
  });

  it("ignores DISABLE_RATE_LIMITS in production", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubEnv("DISABLE_RATE_LIMITS", "true");
    await seed(IP, "upload", 1000, 10);

    expect(await fail(checkIPRateLimitEffect(IP))).toBeInstanceOf(RateLimited);
    expect(logLines(warn)[0]).toMatchObject({ level: "warn" });
  });
});

describe("row lock", () => {
  it("seeds every lock slot and meters through the locked row", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    const slots = await db
      .select({ slot: rateLimitLocks.slot })
      .from(rateLimitLocks)
      .orderBy(rateLimitLocks.slot);

    expect(slots.map(({ slot }) => slot)).toEqual(Array.from({ length: 256 }, (_, i) => i));
    expect(await run(checkIPRateLimitEffect(IP))).toMatchObject({
      remaining: { hourly: 9, daily: 49 },
    });
    expect(await rowCount(IP, "upload")).toBe(1);
  });

  it("fails closed when no lock slot is seeded", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const seeded = await db.select({ slot: rateLimitLocks.slot }).from(rateLimitLocks);

    await db.delete(rateLimitLocks);

    try {
      const refusal = await fail(checkIPRateLimitEffect(IP));

      expect(refusal).toBeInstanceOf(RateLimitUnavailable);
      expect(logLines(error)[0]).toMatchObject({ msg: "Rate limit store failed" });
    } finally {
      await db.insert(rateLimitLocks).values(seeded);
    }
  });
});

describe("handle-check limiter (Effect)", () => {
  it("admits 100 an hour and refuses the 101st", async () => {
    const { checkHandleRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "handle_check", 30 * 60 * 1000, 99);

    const last = await run(checkHandleRateLimitEffect(IP));

    expect(last.remaining.hourly).toBe(0);

    const refusal = await fail(checkHandleRateLimitEffect(IP));

    expect(refusal).toMatchObject({
      message: "Too many handle checks. Please try again later.",
    });
    // The 99 seeded rows are 30 minutes old, so the next slot frees in 30 minutes, not an hour.
    expect(Math.abs(refusal.retryAfterSeconds - 30 * 60)).toBeLessThan(5);
    expect(await rowCount(IP, "handle_check")).toBe(100);
  });

  it("expires its rows after an hour", async () => {
    const { checkHandleRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await run(checkHandleRateLimitEffect(IP));
    const [row] = await db.select().from(uploadRateLimits);

    expect(new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime()).toBe(HOUR_MS);
  });

  it("fails closed with RateLimitUnavailable and logs when the store is down", async () => {
    const { checkHandleRateLimitEffect } = await import("@/lib/rate-limit/ip");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const refusal = await fail(checkHandleRateLimitEffect(IP), brokenDb);

    expect(refusal).toBeInstanceOf(RateLimitUnavailable);
    expect(refusal).toMatchObject({ retryAfterSeconds: 60 });
    expect(logLines(error)[0]).toMatchObject({ level: "error", limiter: "handle_check" });
  });
});
