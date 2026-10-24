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
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { createTestDb } from "@/tests/helpers/pglite-db";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), log: vi.fn() }));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://unused" } },
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

const { GET: getShard } = await import("@/app/api/sitemap/[id]/route");

const { GET: getIndex } = await import("@/app/api/sitemap-index/route");

let testDb: Awaited<ReturnType<typeof createTestDb>>;

const brokenDb = {
  select: () => {
    throw Object.assign(new Error("connection terminated unexpectedly"), { code: "08006" });
  },
};

interface HangingChain {
  from: () => HangingChain;
  innerJoin: () => HangingChain;
  where: () => HangingChain;
  orderBy: () => HangingChain;
  limit: () => HangingChain;
  offset: () => Promise<never>;
}

// The query builder chain of getIndexableProfileWindow, ending in a statement that never returns.
const hangingChain: HangingChain = {
  from: () => hangingChain,
  innerJoin: () => hangingChain,
  where: () => hangingChain,
  orderBy: () => hangingChain,
  limit: () => hangingChain,
  offset: () => new Promise<never>(() => {}),
};

const hangingDb = { select: () => hangingChain };

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(() => {
  mocks.getDb.mockReset();
  mocks.log.mockReset();
  mocks.getDb.mockImplementation(() => testDb.db);
});

afterEach(() => {
  vi.useRealTimers();
});

function shard(id: string) {
  return getShard(new Request(`https://clickfolio.me/sitemap/${id}.xml`), {
    params: Promise.resolve({ id }),
  });
}

function index() {
  return getIndex(new Request("https://clickfolio.me/sitemap.xml"));
}

function expectRetryLater(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("300");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
  expect(response.headers.get("Content-Type")).toBe("text/plain");
}

describe("sitemap routes", () => {
  it("serves the static entries of shard 0 with the cache headers", async () => {
    const response = await shard("0");
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/explore");
  });

  it("serves the index with one shard", async () => {
    const response = await index();

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("/sitemap/0.xml");
  });

  it("answers 400 for a bad id and 404 for a shard past the end", async () => {
    expect((await shard("abc")).status).toBe(400);
    expect((await shard("4")).status).toBe(404);
  });

  describe("when the database fails", () => {
    beforeEach(() => {
      mocks.getDb.mockImplementation(() => brokenDb);
    });

    it("answers shard 0 with 503, not a static-only sitemap", async () => {
      const response = await shard("0");

      expectRetryLater(response);
      expect(await response.text()).not.toContain("<urlset");

      expect(mocks.log).toHaveBeenCalledWith(
        "error",
        "request failed",
        expect.objectContaining({ failure: "DbFailed", operation: "sitemap.shard" }),
      );
    });

    it("answers a later shard with 503, not an empty urlset", async () => {
      const response = await shard("1");

      expectRetryLater(response);
      expect(await response.text()).not.toContain("<urlset");
    });

    it("answers the index with 503 instead of 500", async () => {
      expectRetryLater(await index());
    });
  });

  it("answers 503 when the database never answers", async () => {
    vi.useFakeTimers();
    mocks.getDb.mockImplementation(() => hangingDb);

    const pending = shard("0");
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.db + 1);
    const response = await pending;

    expectRetryLater(response);

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "request failed",
      expect.objectContaining({ kind: "timeout", operation: "sitemap.shard" }),
    );
  });
});
