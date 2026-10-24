import { Effect, Layer } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { resumes, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { StatusChannel } from "@/lib/effect/services/status-channel";
import { expireWaitingForCache } from "@/lib/parse/pipeline";
import { WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";

// The await-cache timer is a Workflow step: Workflows retries it until it returns, and its
// result decides whether the failure email goes out. Runs against real SQL.

const T0 = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

// The status Durable Object is unbound, so notifying is a no-op.
function expire(resumeId: string) {
  return Effect.runPromise(
    Effect.provide(
      expireWaitingForCache(resumeId),
      Layer.mergeAll(Db.layerFrom(db), StatusChannel.layerFrom(undefined)),
    ),
  );
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await db.insert(user).values({
    id: "user-1",
    name: "User",
    email: "user@example.com",
    createdAt: T0,
    updatedAt: T0,
  });
});

async function seed(id: string, values: Partial<typeof resumes.$inferInsert>) {
  await db.insert(resumes).values({
    id,
    userId: "user-1",
    r2Key: `users/user-1/${id}/resume.pdf`,
    fileHash: "hash",
    createdAt: T0,
    ...values,
  });
}

describe("expireWaitingForCache", () => {
  it("expires a waiting row and reports it", async () => {
    await seed("r1", { status: "waiting_for_cache" });

    await expect(expire("r1")).resolves.toBe(true);

    const [row] = await db.select().from(resumes).where(eq(resumes.id, "r1"));
    expect(row).toMatchObject({
      status: "failed",
      errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
    });
  });

  it("still reports expiry when a retry finds the row its first attempt already failed", async () => {
    await seed("r1", { status: "waiting_for_cache" });

    // First attempt: the UPDATE commits, then the step is lost before it returns.
    await expect(expire("r1")).resolves.toBe(true);

    // Workflows retries the step. The journal has no result, so the answer must still be
    // "expired": `false` would skip the failure email for good.
    await expect(expire("r1")).resolves.toBe(true);
  });

  it.each([
    ["completed by the identical parse", { status: "completed" as const }],
    [
      "failed by the parse it was waiting on",
      { status: "failed" as const, errorMessage: "Your PDF could not be read." },
    ],
    [
      "failed by the parse it was waiting on, carrying a stale timeout message",
      {
        status: "failed" as const,
        errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
        lastAttemptError: '{"type":"invalid_pdf"}',
      },
    ],
    ["retried by the user", { status: "queued" as const }],
  ])("reports resolved for a row %s", async (_label, values) => {
    await seed("r1", values);

    await expect(expire("r1")).resolves.toBe(false);
  });

  it("reports resolved for a row that no longer exists", async () => {
    await expect(expire("gone")).resolves.toBe(false);
  });
});
