import { verifyToken } from "@clerk/backend";
import { sql } from "drizzle-orm";
import { z } from "zod";
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
import { uploadRateLimits, user } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/utils/hash";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

interface DbHolder {
  db: TestDb | null;
}

const holder = vi.hoisted(() => {
  const value: DbHolder = { db: null };

  return value;
});

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

const mockVerifyToken = vi.mocked(verifyToken);

const NOW = "2026-01-01T00:00:00.000Z";

const IP = "203.0.113.7";

const bodySchema = z.looseObject({
  error: z.string().optional(),
  code: z.string().optional(),
  available: z.boolean().optional(),
});

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  holder.db = db;
  await testDb.reset();
  await db.delete(uploadRateLimits);
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://clickfolio.me");
  vi.stubEnv("DISABLE_RATE_LIMITS", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function seedUser(clerkId: string, handle: string) {
  await db.insert(user).values({
    id: `row-${clerkId}`,
    name: "Test User",
    email: `${clerkId}@example.com`,
    clerkId,
    handle,
    onboardingCompleted: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function verifiedAs(clerkId: string) {
  mockVerifyToken.mockResolvedValue({
    __raw: "jwt",
    iss: "https://clerk.test",
    sub: clerkId,
    sid: "sess_1",
    nbf: 0,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  });
}

async function check(handle: string | null, options: { signedIn?: boolean } = {}) {
  const { GET } = await import("@/app/api/handle/check/route");

  const url = new URL("https://clickfolio.me/api/handle/check");

  if (handle !== null) url.searchParams.set("handle", handle);

  const headers = new Headers({ "cf-connecting-ip": IP });

  if (options.signedIn) headers.set("Cookie", "__session=jwt");

  const response = await GET(new Request(url, { headers }));

  return { response, body: bodySchema.parse(await response.json()) };
}

describe("GET /api/handle/check", () => {
  it("400s a missing handle and a malformed one", async () => {
    expect((await check(null)).response.status).toBe(400);

    const { response, body } = await check("a");

    expect(response.status).toBe(400);
    expect(body.error).toBe("Handle must be at least 3 characters");
  });

  it("answers reserved without touching the database", async () => {
    holder.db = null;

    const { body } = await check("api");

    expect(body).toEqual({ available: false, reason: "reserved" });
  });

  it("reports a free handle available without asking Clerk", async () => {
    const { response, body } = await check("free-handle", { signedIn: true });

    expect(response.status).toBe(200);
    expect(body).toEqual({ available: true });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("reports a handle owned by someone else as taken", async () => {
    await seedUser("user_a", "taken-handle");

    const { body } = await check("Taken-Handle");

    expect(body).toEqual({ available: false });
  });

  it("reports the signed-in owner's own handle as available and current", async () => {
    await seedUser("user_a", "my-handle");
    verifiedAs("user_a");

    const { body } = await check("my-handle", { signedIn: true });

    expect(body).toEqual({ available: true, isCurrentHandle: true });
  });

  it("treats an expired token as signed out", async () => {
    await seedUser("user_a", "my-handle");
    mockVerifyToken.mockRejectedValue(
      Object.assign(new Error("expired"), { reason: "token-expired" }),
    );

    const { body } = await check("my-handle", { signedIn: true });

    expect(body).toEqual({ available: false });
  });

  it("fails the check, never answers taken, when Clerk's key set is unreachable", async () => {
    await seedUser("user_a", "my-handle");
    mockVerifyToken.mockRejectedValue(
      Object.assign(new Error("jwks down"), { reason: "jwk-failed-to-resolve" }),
    );

    const { response, body } = await check("my-handle", { signedIn: true });

    expect(response.status).toBe(500);
    expect(body.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(body.available).toBeUndefined();
  });

  it("answers 429 with Retry-After once the hourly limit is used", async () => {
    const ipHash = await sha256Hex(new TextEncoder().encode(IP));
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    await db.insert(uploadRateLimits).values(
      Array.from({ length: 100 }, (_, i) => ({
        id: `seed-${i}`,
        ipHash,
        actionType: "handle_check" as const,
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        expiresAt,
      })),
    );

    const { response, body } = await check("anything");

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many handle checks. Please try again later.");
    // Five minutes into the window: a slot frees in 55 minutes, not the whole hour.
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(3200);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(3300);
  });

  it("answers 503 with Retry-After when the limit store is down", async () => {
    await db.execute(sql`ALTER TABLE upload_rate_limits RENAME TO upload_rate_limits_off`);

    try {
      const { response } = await check("anything");

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
    } finally {
      await db.execute(sql`ALTER TABLE upload_rate_limits_off RENAME TO upload_rate_limits`);
    }
  });

  it("answers the standard database error when the lookup fails after the limiter", async () => {
    await db.execute(sql`ALTER TABLE "user" RENAME TO user_off`);

    try {
      const { response, body } = await check("anything");

      expect(response.status).toBe(500);
      expect(body.code).toBe("DATABASE_ERROR");
    } finally {
      await db.execute(sql`ALTER TABLE user_off RENAME TO "user"`);
    }
  });
});
