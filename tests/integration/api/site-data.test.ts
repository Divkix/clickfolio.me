import type { Effect } from "effect";
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
import { siteData, user } from "@/lib/db/schema";
import type { Db } from "@/lib/effect/db";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { createTestDb, INDEXABLE_CONTENT } from "@/tests/helpers/pglite-db";

const mocks = vi.hoisted(() => ({ db: vi.fn(), log: vi.fn() }));

// The real wrapper authenticates through Clerk on the same Db (tests/integration/effect/auth.test.ts);
// this stand-in signs user_1 in and hands the route the per-test database, so a broken or hanging
// one reaches the route's own query.
vi.mock("@/lib/auth/with-auth", async () => {
  const { runRoute } = await import("@/lib/effect/edges");
  const { Db: DbService } = await import("@/lib/effect/db");

  return {
    withUserEffect: (
      request: Request | undefined,
      handler: (context: { user: { id: string } }) => Effect.Effect<Response, never, Db>,
    ) => runRoute(request, handler({ user: { id: "user_1" } }), DbService.layerFrom(mocks.db())),
  };
});

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

const { GET } = await import("@/app/api/site-data/route");

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

const brokenDb = {
  select: () => {
    throw Object.assign(new Error("connection terminated unexpectedly"), { code: "08006" });
  },
};

interface HangingChain {
  from: () => HangingChain;
  where: () => HangingChain;
  limit: () => Promise<never>;
}

// The query builder chain of the route, ending in a statement that never returns.
const hangingChain: HangingChain = {
  from: () => hangingChain,
  where: () => hangingChain,
  limit: () => new Promise<never>(() => {}),
};

const hangingDb = { select: () => hangingChain };

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  mocks.log.mockReset();
  mocks.db.mockReset();
  mocks.db.mockImplementation(() => testDb.db);

  await testDb.db.insert(user).values({
    id: "user_1",
    name: "Avery",
    email: "avery@example.com",
    createdAt: NOW,
    updatedAt: NOW,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/site-data", () => {
  it("answers null for a user without a portfolio", async () => {
    const response = await GET(new Request("https://clickfolio.me/api/site-data"));

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("returns the user's site data", async () => {
    await testDb.db.insert(siteData).values({
      id: "site_1",
      userId: "user_1",
      content: INDEXABLE_CONTENT,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const response = await GET(new Request("https://clickfolio.me/api/site-data"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "site_1", userId: "user_1" });
  });

  it("answers 503 with the standard error body when the database is unavailable", async () => {
    mocks.db.mockImplementation(() => brokenDb);

    const response = await GET(new Request("https://clickfolio.me/api/site-data"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "request failed",
      expect.objectContaining({ failure: "DbFailed", operation: "site-data.get" }),
    );
  });

  it("answers 504 when the database never answers", async () => {
    vi.useFakeTimers();
    mocks.db.mockImplementation(() => hangingDb);

    const pending = GET(new Request("https://clickfolio.me/api/site-data"));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.db + 1);

    expect((await pending).status).toBe(504);
  });
});
