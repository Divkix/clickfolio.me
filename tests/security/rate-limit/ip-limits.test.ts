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
import { uploadRateLimits } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/utils/hash";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

// The Promise edges build their own Db layer from getDb(env.HYPERDRIVE): point it at PGlite.
const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock("cloudflare:workers", () => ({ env: { HYPERDRIVE: { connectionString: "unused" } } }));

vi.mock("@/lib/db", () => ({ getDb: () => store.get("db") }));

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
  store.set("db", db);
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

  it("refuses the 11th request in an hour with RateLimited and an hour Retry-After", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 5 * 60 * 1000, 10);
    const refusal = await fail(checkIPRateLimitEffect(IP));

    expect(refusal).toBeInstanceOf(RateLimited);
    expect(refusal).toMatchObject({
      message: expect.stringContaining("Limit: 10/hour"),
      retryAfterSeconds: 3600,
    });
    expect(await rowCount(IP, "upload")).toBe(10);
  });

  it("refuses at 50 a day even when the hour is clear, with a day Retry-After", async () => {
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 5 * HOUR_MS, 50);
    const refusal = await fail(checkIPRateLimitEffect(IP));

    expect(refusal).toMatchObject({
      message: expect.stringContaining("Limit: 50/day"),
      retryAfterSeconds: 86_400,
    });
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

  // PGlite serializes transactions on one connection, so this cannot prove the advisory lock
  // works under real concurrency; it pins the count-then-insert arithmetic under a burst.
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

describe("handle-check limiter (Effect)", () => {
  it("admits 100 an hour and refuses the 101st", async () => {
    const { checkHandleRateLimitEffect } = await import("@/lib/rate-limit/ip");

    await seed(IP, "handle_check", 1000, 99);

    const last = await run(checkHandleRateLimitEffect(IP));

    expect(last.remaining.hourly).toBe(0);

    const refusal = await fail(checkHandleRateLimitEffect(IP));

    expect(refusal).toMatchObject({
      message: "Too many handle checks. Please try again later.",
      retryAfterSeconds: 3600,
    });
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

describe("Promise edges", () => {
  it("answer an upload refusal with the old result shape", async () => {
    const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

    await seed(IP, "upload", 1000, 10);
    const result = await checkIPRateLimit(IP);

    expect(result).toEqual({
      allowed: false,
      remaining: { hourly: 0, daily: 40 },
      message: "Too many upload requests. Try again in an hour. (Limit: 10/hour)",
    });
  });

  it("count down remaining uploads", async () => {
    const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

    expect(await checkIPRateLimit(IP)).toEqual({
      allowed: true,
      remaining: { hourly: 9, daily: 49 },
    });
  });

  it("keep refusing an upload when the store is down, flagged unavailable", async () => {
    const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

    vi.spyOn(console, "error").mockImplementation(() => {});
    store.set("db", brokenDb);

    const result = await checkIPRateLimit(IP);

    expect(result).toMatchObject({
      allowed: false,
      unavailable: true,
      retryAfterSeconds: 60,
      message: expect.stringContaining("temporarily unavailable"),
    });
  });

  it("answer a handle-check refusal with the old result shape", async () => {
    const { checkHandleRateLimit } = await import("@/lib/rate-limit/ip");

    await seed(IP, "handle_check", 1000, 100);

    expect(await checkHandleRateLimit(IP)).toEqual({
      allowed: false,
      remaining: { hourly: 0, daily: 0 },
      message: "Too many handle checks. Please try again later.",
    });
  });

  it("still fail open for handle checks when the store is down", async () => {
    const { checkHandleRateLimit } = await import("@/lib/rate-limit/ip");

    vi.spyOn(console, "error").mockImplementation(() => {});
    store.set("db", brokenDb);

    expect((await checkHandleRateLimit(IP)).allowed).toBe(true);
  });
});
