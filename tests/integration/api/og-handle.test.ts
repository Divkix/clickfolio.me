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
import { siteData, user } from "@/lib/db/schema";
import { createTestDb, INDEXABLE_CONTENT } from "@/tests/helpers/pglite-db";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), log: vi.fn(), render: vi.fn() }));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://unused" } },
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

vi.mock("@cf-wasm/resvg/workerd", () => ({
  Resvg: { async: async (svg: string) => mocks.render(svg) },
}));

const { GET } = await import("@/app/api/og/[handle]/route");

const NOW = "2026-01-01T00:00:00.000Z";

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
  limit: () => Promise<never>;
}

// The query builder chain of the card lookup, ending in a statement that never returns.
const hangingChain: HangingChain = {
  from: () => hangingChain,
  innerJoin: () => hangingChain,
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
  mocks.getDb.mockReset();
  mocks.log.mockReset();
  mocks.render.mockReset();
  mocks.getDb.mockImplementation(() => testDb.db);
  mocks.render.mockResolvedValue({ render: () => ({ asPng: () => new Uint8Array([137, 80]) }) });

  await testDb.db.insert(user).values({
    id: "user_live",
    name: "Live Person",
    email: "live@example.com",
    handle: "live",
    createdAt: NOW,
    updatedAt: NOW,
  });

  await testDb.db.insert(siteData).values({
    id: "site_live",
    userId: "user_live",
    content: INDEXABLE_CONTENT,
    previewName: "Live Person",
    createdAt: NOW,
    updatedAt: NOW,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function ask(handle: string) {
  return GET(new Request(`https://clickfolio.me/api/og/${handle}`), {
    params: Promise.resolve({ handle }),
  });
}

describe("GET /api/og/[handle]", () => {
  it("renders the card of a published portfolio", async () => {
    const response = await ask("live");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("answers an unknown handle with the cacheable not-found card", async () => {
    const response = await ask("nobody");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("answers 503, not the not-found card, when the database fails", async () => {
    mocks.getDb.mockImplementation(() => brokenDb);

    const response = await ask("live");

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("text/plain");

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "request failed",
      expect.objectContaining({ failure: "DbFailed", operation: "og.profile" }),
    );
  });

  it("answers 503 when the database never answers", async () => {
    vi.useFakeTimers();
    mocks.getDb.mockImplementation(() => hangingDb);

    const pending = ask("live");
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.db + 1);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("logs a render failure and falls back to the not-found card", async () => {
    mocks.render.mockRejectedValue(new Error("wasm trapped"));

    const response = await ask("live");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "OG image generation error:",
      expect.objectContaining({ "error.message": "wasm trapped" }),
    );
  });
});
