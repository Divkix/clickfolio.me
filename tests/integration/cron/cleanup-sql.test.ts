import { eq, type SQL } from "drizzle-orm";
import { Layer } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PgQueryable } from "@/lib/db";
import { handleChanges, resumes, uploadRateLimits, user } from "@/lib/db/schema";
import { runCleanup } from "@/lib/cron/cleanup";
import { Db } from "@/lib/effect/db";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

type FakeBucket = Parameters<typeof R2Store.layerFrom>[0];

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

const LONG_AGO = "2020-01-01T00:00:00.000Z";

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await db.delete(uploadRateLimits);
  await db.delete(handleChanges);

  await db.insert(user).values({
    id: "user_1",
    name: "Avery",
    email: "avery@example.com",
    createdAt: LONG_AGO,
    updatedAt: LONG_AGO,
  });
});

async function addResume(id: string, status: "failed" | "processing" | "completed", at: string) {
  await db.insert(resumes).values({
    id,
    userId: "user_1",
    r2Key: `users/user_1/${id}/cv.pdf`,
    status,
    createdAt: at,
    updatedAt: at,
  });
}

function fakeBucket() {
  const del = vi.fn<FakeBucket["delete"]>(async () => {});

  const bucket: FakeBucket = {
    get: async () => null,
    put: async () => ({ size: 0, etag: "e" }),
    delete: del,
    head: async () => null,
    list: async () => ({ objects: [], truncated: false }),
  };

  return { bucket, del };
}

function layerFor(handle: PgQueryable, bucket: FakeBucket) {
  return Layer.mergeAll(
    Db.layerFrom(handle),
    R2Store.layerFrom(bucket),
    R2DeleteScheduler.layerFrom({ create: async () => ({ id: "w1" }) }),
  );
}

async function remainingIds() {
  const rows = await db.select({ id: resumes.id }).from(resumes).orderBy(resumes.id);

  return rows.map((row) => row.id);
}

describe("cleanup against real SQL", () => {
  it("deletes only stale failed resumes and then their R2 objects", async () => {
    await addResume("stale_failed", "failed", LONG_AGO);
    await addResume("fresh_failed", "failed", new Date().toISOString());
    await addResume("stale_processing", "processing", LONG_AGO);
    await addResume("stale_completed", "completed", LONG_AGO);
    const { bucket, del } = fakeBucket();

    const result = await runCleanup(layerFor(db, bucket));

    expect(result.deleted.failedResumes).toBe(1);
    expect(await remainingIds()).toEqual(["fresh_failed", "stale_completed", "stale_processing"]);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("users/user_1/stale_failed/cv.pdf");
  });

  it("deletes expired rate limits and old handle changes", async () => {
    await db.insert(uploadRateLimits).values({
      id: "rl_old",
      ipHash: "h",
      actionType: "upload",
      createdAt: LONG_AGO,
      expiresAt: LONG_AGO,
    });

    await db.insert(handleChanges).values({
      id: "hc_old",
      userId: "user_1",
      newHandle: "avery",
      createdAt: LONG_AGO,
    });

    await runCleanup(layerFor(db, fakeBucket().bucket));

    expect(await db.select().from(uploadRateLimits)).toEqual([]);
    expect(await db.select().from(handleChanges)).toEqual([]);
  });

  it("keeps the row and the object of a resume that leaves 'failed' before the delete runs", async () => {
    await addResume("retried", "failed", LONG_AGO);
    await addResume("still_failed", "failed", LONG_AGO);
    const { bucket, del } = fakeBucket();

    // The user retries between the cleanup's SELECT and its guarded DELETE.
    const racing: PgQueryable = Object.create(db, {
      delete: {
        value: (table: typeof resumes) => ({
          where: (condition: SQL | undefined) => ({
            returning: async (fields: { id: typeof resumes.id; r2Key: typeof resumes.r2Key }) => {
              await db
                .update(resumes)
                .set({ status: "queued", updatedAt: new Date().toISOString() })
                .where(eq(resumes.id, "retried"));

              return db.delete(table).where(condition).returning(fields);
            },
          }),
        }),
      },
    });

    const result = await runCleanup(layerFor(racing, bucket));

    expect(result.deleted.failedResumes).toBe(1);
    expect(await remainingIds()).toEqual(["retried"]);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("users/user_1/still_failed/cv.pdf");
  });
});
