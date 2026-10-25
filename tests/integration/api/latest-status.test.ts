import { serverHandler } from "@/tests/helpers/server-route";
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
import { resumes, user } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { getStatusView, WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
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
    APP_URL: "https://clickfolio.me",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

const mockVerifyToken = vi.mocked(verifyToken);

const NOW = "2026-01-01T00:00:00.000Z";

const bodySchema = z.nullable(
  z.looseObject({
    id: z.string().optional(),
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    can_retry: z.boolean().optional(),
    createdAt: z.string().optional(),
    code: z.string().optional(),
  }),
);

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
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function seedUser(clerkId: string) {
  await db.insert(user).values({
    id: `row-${clerkId}`,
    name: "Test User",
    email: `${clerkId}@example.com`,
    clerkId,
    handle: `handle-${clerkId}`,
    onboardingCompleted: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

type SeedResume = Partial<typeof resumes.$inferInsert> & { id: string; userId: string };

async function seedResume(row: SeedResume) {
  await db.insert(resumes).values({
    r2Key: `users/${row.userId}/resume.pdf`,
    fileHash: `hash-${row.id}`,
    status: "completed",
    createdAt: NOW,
    updatedAt: NOW,
    ...row,
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

async function latest(signedIn = true) {
  const GET = serverHandler((await import("@/app/routes/api/resume/latest-status")).Route, "GET");

  const response = await GET(
    new Request("https://clickfolio.me/api/resume/latest-status", {
      headers: signedIn ? { Cookie: "__session=jwt" } : {},
    }),
  );

  return { response, body: bodySchema.parse(await response.json()) };
}

describe("GET /api/resume/latest-status", () => {
  it("returns the signed-in user's newest resume in the wire shape", async () => {
    await seedUser("user_a");
    await seedResume({ id: "old", userId: "row-user_a", createdAt: "2025-12-01T00:00:00.000Z" });
    await seedResume({
      id: "new",
      userId: "row-user_a",
      status: "failed",
      errorMessage: "PDF parsing error",
      totalAttempts: 2,
      createdAt: NOW,
    });
    verifiedAs("user_a");

    const { response, body } = await latest();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: "new",
      status: "failed",
      error: "PDF parsing error",
      can_retry: getStatusView({
        status: "failed",
        createdAt: NOW,
        retryCount: 0,
        totalAttempts: 2,
        lastAttemptError: null,
      }).canRetry,
      createdAt: expect.any(String),
    });
    // PGlite renders timestamptz in the session zone; the instant is what matters.
    expect(new Date(body?.createdAt ?? "").toISOString()).toBe(NOW);
  });

  it("returns null for a user without resumes", async () => {
    await seedUser("user_a");
    verifiedAs("user_a");

    const { response, body } = await latest();

    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it("never returns another user's resume", async () => {
    await seedUser("user_a");
    await seedUser("user_b");
    await seedResume({ id: "resume-b", userId: "row-user_b" });
    verifiedAs("user_a");

    const { body } = await latest();

    expect(body).toBeNull();

    await seedResume({
      id: "resume-a",
      userId: "row-user_a",
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    const second = await latest();

    expect(second.body?.id).toBe("resume-a");
  });

  it("answers 401 without a session and 401 for an expired token", async () => {
    expect((await latest(false)).response.status).toBe(401);

    mockVerifyToken.mockRejectedValue(
      Object.assign(new Error("expired"), { reason: "token-expired" }),
    );

    expect((await latest()).response.status).toBe(401);
  });

  it("agrees with getStatusView on can_retry for every stored state", async () => {
    await seedUser("user_a");
    verifiedAs("user_a");

    const cases: Array<{
      status: ResumeStatus;
      totalAttempts: number;
      lastAttemptError: string | null;
    }> = [
      {
        status: "failed",
        totalAttempts: 2,
        lastAttemptError: JSON.stringify({ type: "ai_provider_error" }),
      },
      { status: "failed", totalAttempts: 6, lastAttemptError: null },
      {
        status: "failed",
        totalAttempts: 1,
        lastAttemptError: JSON.stringify({ type: "invalid_pdf" }),
      },
    ];

    for (const [index, row] of cases.entries()) {
      await db.delete(resumes);
      await seedResume({ id: `r-${index}`, userId: "row-user_a", ...row });

      const { body } = await latest();

      expect(body?.can_retry).toBe(
        getStatusView({
          status: row.status,
          createdAt: NOW,
          retryCount: 0,
          totalAttempts: row.totalAttempts,
          lastAttemptError: row.lastAttemptError,
        }).canRetry,
      );
    }
  });

  it("replaces the error with the cache-timeout message for a stale waiting resume", async () => {
    await seedUser("user_a");
    await seedResume({
      id: "stale",
      userId: "row-user_a",
      status: "waiting_for_cache",
      errorMessage: "ignored",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    verifiedAs("user_a");

    const { body } = await latest();

    expect(body?.status).toBe("failed");
    expect(body?.error).toBe(WAITING_FOR_CACHE_TIMEOUT_MESSAGE);
  });

  it("answers the standard database error when the read fails", async () => {
    await seedUser("user_a");
    verifiedAs("user_a");
    await db.execute(sql`ALTER TABLE resumes RENAME TO resumes_off`);

    try {
      const { response, body } = await latest();

      expect(response.status).toBe(500);
      expect(body?.code).toBe("DATABASE_ERROR");
    } finally {
      await db.execute(sql`ALTER TABLE resumes_off RENAME TO resumes`);
    }
  });
});
