import { Effect, Layer } from "effect";
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
import { loadAdminStats } from "@/lib/data/admin-overview";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { DbFailed, HttpUpstreamFailed } from "@/lib/effect/failures";
import { Umami } from "@/lib/effect/services/umami";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let errorSpy: ReturnType<typeof vi.spyOn>;

const today = lastNUtcDays(1)[0];

const umamiUp = Umami.layerFrom({
  getStats: () => Effect.succeed({ pageviews: 7, visitors: 3 }),
  getPageviews: () =>
    Effect.succeed({ pageviews: [{ x: `${today} 00:00:00`, y: 5 }], sessions: [] }),
  getMetrics: () => Effect.succeed([]),
});

const umamiDown = Umami.layerFrom({
  getStats: () =>
    Effect.fail(
      new HttpUpstreamFailed({
        operation: "umami.stats",
        kind: "unavailable",
        message: "umami offline",
        host: "umami",
      }),
    ),
  getPageviews: () => Effect.succeed({ pageviews: [], sessions: [] }),
  getMetrics: () => Effect.succeed([]),
});

function run<A, E>(program: Effect.Effect<A, E, Db | Umami>, umami: Layer.Layer<Umami>) {
  return Effect.runPromise(Effect.provide(program, Layer.mergeAll(Db.layerFrom(db), umami)));
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
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function seed() {
  await db.insert(user).values([
    { id: "u1", name: "One", email: "one@example.com", createdAt: NOW, updatedAt: NOW },
    { id: "u2", name: "Two", email: "two@example.com", createdAt: NOW, updatedAt: NOW },
  ]);

  await db.insert(siteData).values({
    id: "s1",
    userId: "u1",
    content: INDEXABLE_CONTENT,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const base = { r2Key: "k", fileHash: "h", createdAt: NOW, updatedAt: NOW };

  await db.insert(resumes).values([
    { ...base, id: "r1", userId: "u1", status: "processing" },
    { ...base, id: "r2", userId: "u1", status: "queued" },
    { ...base, id: "r3", userId: "u2", status: "failed" },
    { ...base, id: "r4", userId: "u2", status: "completed" },
  ]);
}

describe("loadAdminStats", () => {
  it("counts users, sites and resume states and fills the week with Umami views", async () => {
    await seed();

    const stats = await run(loadAdminStats(), umamiUp);

    expect(stats).toMatchObject({
      totalUsers: 2,
      publishedResumes: 1,
      processingResumes: 2,
      failedResumes: 1,
      viewsToday: 7,
    });
    expect(stats.dailyViews).toHaveLength(7);
    expect(stats.dailyViews.at(-1)).toEqual({ date: today, views: 5 });
    expect(stats.recentSignups).toHaveLength(2);
  });

  it("logs and shows zero views when Umami is down, without failing the page", async () => {
    await seed();

    const stats = await run(loadAdminStats(), umamiDown);

    expect(stats.viewsToday).toBe(0);
    expect(stats.dailyViews.every((day) => day.views === 0)).toBe(true);
    expect(stats.totalUsers).toBe(2);

    const lines = logLines(errorSpy);
    const entry = lines.find((line) => line.msg === "[admin] Umami API unavailable");

    expect(entry).toMatchObject({ level: "error", operation: "umami.stats", kind: "unavailable" });
  });

  it("fails with a typed DbFailed when the database is down", async () => {
    const closed = await createTestDb();

    await closed.close();

    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.provide(loadAdminStats(), Layer.mergeAll(Db.layerFrom(closed.db), umamiUp)),
      ),
    );

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ operation: "admin.overview" });
  });
});
