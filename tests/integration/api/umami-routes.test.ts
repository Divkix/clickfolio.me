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
import { handleChanges, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const auth = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), db: vi.fn() }));

vi.mock("@/lib/auth/clerk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
  authenticate: (await import("../../helpers/authenticate-stub")).authenticateStub(() =>
    auth.user(),
  ),
}));

vi.mock("@/lib/auth/admin", async () => ({
  authenticateAdmin: (await import("../../helpers/authenticate-stub")).authenticateAdminStub(() =>
    auth.admin(),
  ),
}));

vi.mock("@/lib/db", () => ({ getDb: () => auth.db() }));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: {},
    UMAMI_API_URL: "https://umami.invalid-host.test",
    UMAMI_USERNAME: "admin-user",
    UMAMI_PASSWORD: "admin-password",
  },
}));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  auth.db.mockReturnValue(db);
});

afterAll(async () => {
  await testDb.close();
});

function json(body: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type Upstream = (endpoint: string, path: string | null) => Response | Promise<Response>;

/** Answers the login, then hands every website GET (endpoint + path filter) to `upstream`. */
function stubUmami(upstream: Upstream) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));

    if (url.pathname === "/api/auth/login") return json({ token: "tok" });

    return upstream(url.pathname.split("/").pop() ?? "", url.searchParams.get("path"));
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function umamiBody(endpoint: string, path: string | null): JsonValue {
  const views = path === "/@alice" ? 10 : 5;

  if (endpoint === "stats") return { pageviews: views, visitors: views / 5, visits: 1 };

  if (endpoint === "pageviews") {
    return {
      pageviews: [{ x: "2026-01-01T00:00:00Z", y: views }],
      sessions: [{ x: "2026-01-01T00:00:00Z", y: 1 }],
    };
  }

  return [
    { x: null, y: 2 },
    { x: "news.example", y: 1 },
  ];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    auth.admin.mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", name: "Admin", isAdmin: true },
      error: null,
    });
  });

  it("builds the dashboard from validated Umami data", async () => {
    stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/admin/analytics/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/analytics?period=7d"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=30, stale-while-revalidate=60",
    );
    expect(await response.json()).toMatchObject({
      totals: { views: 5, unique: 1 },
      referrers: [
        { domain: "Direct", count: 2 },
        { domain: "news.example", count: 1 },
      ],
    });
  });

  it("answers 400 for an unknown period without calling Umami", async () => {
    const fetchMock = stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/admin/analytics/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/analytics?period=1y"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid period", code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 with the standard shape when Umami is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubUmami(() => json({}, 502));

    const { GET } = await import("@/app/api/admin/analytics/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/analytics"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("answers 502 when Umami returns a payload of the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubUmami((endpoint, path) =>
      endpoint === "stats" ? json({ pageviews: "many" }) : json(umamiBody(endpoint, path)),
    );

    const { GET } = await import("@/app/api/admin/analytics/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/analytics"));

    expect(response.status).toBe(502);
  });

  it("passes the auth refusal through untouched", async () => {
    auth.admin.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 }),
    });

    const { GET } = await import("@/app/api/admin/analytics/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/analytics"));

    expect(response.status).toBe(403);
  });
});

describe("GET /api/analytics/stats", () => {
  beforeEach(async () => {
    await testDb.reset();

    const now = new Date().toISOString();

    await db.insert(user).values({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      handle: "alice",
      clerkId: "clerk-1",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(handleChanges).values({
      id: "change-1",
      userId: "user-1",
      oldHandle: "alice-old",
      newHandle: "alice",
      createdAt: now,
    });

    auth.user.mockResolvedValue({
      user: { id: "user-1" },
      dbUser: { id: "user-1", handle: "alice", clerkId: "clerk-1" },
      error: null,
    });
  });

  it("sums the current and previous handles", async () => {
    const fetchMock = stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats?period=7d"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await response.json()).toMatchObject({
      totalViews: 15,
      uniqueVisitors: 3,
      period: "7d",
    });

    const paths = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)).searchParams.get("path"))
      .filter((path) => path !== null);

    expect(new Set(paths)).toEqual(new Set(["/@alice", "/@alice-old"]));
  });

  it("excludes a previous handle now owned by someone else from every metric", async () => {
    const now = new Date().toISOString();
    await db.insert(user).values({
      id: "user-2",
      name: "Bob",
      email: "bob@example.com",
      handle: "alice-old",
      clerkId: "clerk-2",
      createdAt: now,
      updatedAt: now,
    });
    const fetchMock = stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    // Load the route after installing the auth, database and upstream mocks.
    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalViews: 10, uniqueVisitors: 2 });

    const paths = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)).searchParams.get("path"))
      .filter((path) => path !== null);

    expect(paths).toHaveLength(5);
    expect(new Set(paths)).toEqual(new Set(["/@alice"]));
  });

  it("loads the handle set once and uses a bounded private cache lifetime", async () => {
    const select = vi.spyOn(db, "select");
    stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("returns empty stats for a user without a handle", async () => {
    const fetchMock = stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    auth.user.mockResolvedValue({
      user: { id: "user-1" },
      dbUser: { id: "user-1", handle: null, clerkId: "clerk-1" },
      error: null,
    });

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats"));

    expect(await response.json()).toMatchObject({ totalViews: 0, viewsByDay: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 for an unknown period", async () => {
    stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats?period=1y"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid period. Use 7d, 30d, or 90d.",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 503 when any Umami call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubUmami((endpoint, path) =>
      endpoint === "metrics" ? json({}, 500) : json(umamiBody(endpoint, path)),
    );

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("answers with the database error shape when the handle lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "select").mockImplementation(() => {
      throw new Error("connection reset");
    });

    const fetchMock = stubUmami((endpoint, path) => json(umamiBody(endpoint, path)));

    const { GET } = await import("@/app/api/analytics/stats/route");
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
