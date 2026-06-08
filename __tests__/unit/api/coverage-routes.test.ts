import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const cookieStore = {
    value: null as string | null,
    get: vi.fn(() => (cookieStore.value ? { value: cookieStore.value } : undefined)),
    set: vi.fn((_name: string, value: string) => {
      cookieStore.value = value;
    }),
    delete: vi.fn(() => {
      cookieStore.value = null;
    }),
  };

  const state = {
    selectResults: [] as unknown[][],
    authResult: null as unknown,
    handleRateLimit: { allowed: true } as { allowed: boolean; message?: string },
    emailRateLimit: { allowed: true } as { allowed: boolean; message?: string },
    uploadRateLimit: {
      allowed: true,
      remaining: { hourly: 9, daily: 49 },
    } as {
      allowed: boolean;
      message?: string;
      remaining: { hourly: number; daily: number };
    },
    disposableResult: { disposable: false } as { disposable: boolean },
    handleTaken: false,
    themeError: null as Response | null,
    requestSize: { valid: true } as { valid: boolean; error?: string },
    adminAuthResult: {
      user: { id: "admin_1", email: "admin@example.com", name: "Admin", isAdmin: true },
      error: null,
    } as unknown,
    cookieStore,
  };

  const nextSelectResult = () => {
    if (state.selectResults.length === 0) {
      throw new Error(
        "No select result queued — push to mocks.state.selectResults before querying",
      );
    }
    return state.selectResults.shift() as unknown[];
  };
  const createChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      values: vi.fn(() => chain),
      set: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
      returning: vi.fn(() => chain),
      // eslint-disable-next-line unicorn/no-thenable -- Drizzle query mocks must be awaitable.
      then: vi.fn(
        (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => {
          try {
            return Promise.resolve(resolve(nextSelectResult()));
          } catch (error) {
            return reject ? Promise.reject(reject(error)) : Promise.reject(error);
          }
        },
      ),
    };
    return chain;
  };

  const db = {
    query: {
      user: { findFirst: vi.fn() },
      siteData: { findFirst: vi.fn() },
      resumes: { findFirst: vi.fn() },
    },
    select: vi.fn(() => createChain()),
    insert: vi.fn(() => createChain()),
    update: vi.fn(() => createChain()),
    delete: vi.fn(() => createChain()),
    batch: vi.fn(async () => undefined),
  };

  const env = {
    CLICKFOLIO_DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })) },
    CLICKFOLIO_R2_BUCKET: { list: vi.fn(async () => ({ objects: [] })) },
    CLICKFOLIO_DISPOSABLE_DOMAINS: { get: vi.fn(async () => "[]") },
    CLICKFOLIO_PARSE_QUEUE: { send: vi.fn(async () => undefined) },
    BETTER_AUTH_SECRET: "test-secret-key-for-pending-upload",
    CF_AI_GATEWAY_ACCOUNT_ID: "acct",
    CF_AI_GATEWAY_ID: "gateway",
    CF_AIG_AUTH_TOKEN: "token",
  };

  return {
    state,
    db,
    env,
    getAuth: vi.fn(async () => ({
      api: { getSession: vi.fn(async () => ({ user: { id: "user_1" } })) },
    })),
    authHandlerGet: vi.fn(async () => Response.json({ method: "GET" })),
    authHandlerPost: vi.fn(async () => Response.json({ method: "POST" })),
    getStats: vi.fn(async () => ({ pageviews: 10, visitors: 4 })),
    getPageviews: vi.fn(async () => ({
      pageviews: [{ x: "2026-05-20T00:00:00Z", y: 6 }],
      sessions: [{ x: "2026-05-20T00:00:00Z", y: 2 }],
    })),
    getMetrics: vi.fn(async (_env: unknown, options: { type: string }) => {
      if (options.type === "referrer") return [{ x: "linkedin.com", y: 3 }];
      if (options.type === "device") return [{ x: "desktop", y: 5 }];
      return [{ x: "US", y: 5 }];
    }),
    performCleanup: vi.fn(async () => ({ deleted: 1 })),
    performR2Cleanup: vi.fn(async () => ({ deleted: 2 })),
    syncDisposableDomains: vi.fn(async () => ({ synced: 3 })),
    recoverOrphanedResumes: vi.fn(async () => ({ recovered: 4 })),
    r2Put: vi.fn(async () => undefined),
    r2Delete: vi.fn(async () => undefined),
    r2GetAsUint8Array: vi.fn(async () => new Uint8Array([1, 2, 3])),
    resvgAsync: vi.fn(async (_svg: string, _options?: unknown) => ({
      render: () => ({
        asPng: () => new Uint8Array([137, 80, 78, 71]),
      }),
    })),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: mocks.env,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => mocks.state.cookieStore),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({ GET: mocks.authHandlerGet, POST: mocks.authHandlerPost })),
}));

vi.mock("@cf-wasm/resvg/workerd", () => ({
  Resvg: {
    async: mocks.resvgAsync,
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuth: mocks.getAuth,
  getEnvValue: vi.fn((env: Record<string, string>, key: string) => env[key] || "fallback-secret"),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(async () => mocks.state.authResult),
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuthForApi: vi.fn(async () => mocks.state.adminAuthResult),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mocks.db),
}));

vi.mock("@/lib/rate-limit/ip", () => ({
  getClientIP: vi.fn(() => "203.0.113.10"),
  checkIPRateLimit: vi.fn(async () => mocks.state.uploadRateLimit),
  checkHandleRateLimit: vi.fn(async () => mocks.state.handleRateLimit),
  checkEmailValidateRateLimit: vi.fn(async () => mocks.state.emailRateLimit),
}));

vi.mock("@/lib/rate-limit/handle-validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit/handle-validation")>();
  return {
    ...actual,
    RESERVED_HANDLES: new Set(["admin", "api"]),
    isHandleTaken: vi.fn(async () => mocks.state.handleTaken),
  };
});

vi.mock("@/lib/email/disposable-check", () => ({
  isDisposableEmail: vi.fn(async () => mocks.state.disposableResult),
}));

vi.mock("@/lib/templates/theme-access", () => ({
  verifyThemeUnlocked: vi.fn(async () => mocks.state.themeError),
}));

vi.mock("@/lib/utils/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/validation")>();
  return {
    ...actual,
    validateRequestSize: vi.fn(() => mocks.state.requestSize),
  };
});

vi.mock("@/lib/umami/client", () => ({
  getStats: mocks.getStats,
  getPageviews: mocks.getPageviews,
  getMetrics: mocks.getMetrics,
}));

vi.mock("@/lib/cron/cleanup", () => ({
  performCleanup: mocks.performCleanup,
}));

vi.mock("@/lib/cron/cleanup-r2", () => ({
  performR2Cleanup: mocks.performR2Cleanup,
}));

vi.mock("@/lib/cron/sync-disposable-domains", () => ({
  syncDisposableDomains: mocks.syncDisposableDomains,
}));

vi.mock("@/lib/cron/recover-orphaned", () => ({
  recoverOrphanedResumes: mocks.recoverOrphanedResumes,
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn((env: typeof mocks.env) => env.CLICKFOLIO_R2_BUCKET),
  R2: {
    put: mocks.r2Put,
    delete: mocks.r2Delete,
    getAsUint8Array: mocks.r2GetAsUint8Array,
  },
}));

vi.mock("drizzle-orm", () => ({
  relations: vi.fn((_table, build) =>
    build({
      many: vi.fn((table) => ({ relation: "many", table })),
      one: vi.fn((table, config) => ({ relation: "one", table, config })),
    }),
  ),
  eq: vi.fn((_field, value) => ({ op: "eq", value })),
  gt: vi.fn((_field, value) => ({ op: "gt", value })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
  or: vi.fn((...conditions) => ({ op: "or", conditions })),
  count: vi.fn(() => ({ op: "count" })),
  desc: vi.fn((field) => ({ op: "desc", field })),
  isNotNull: vi.fn((field) => ({ op: "isNotNull", field })),
  sql: Object.assign(
    vi.fn((strings, ...values) => ({ op: "sql", strings, values })),
    {
      join: vi.fn((items, separator) => ({ op: "sql.join", items, separator })),
    },
  ),
}));

function jsonRequest(path: string, body: unknown, init: RequestInit = {}) {
  return new Request(`https://clickfolio.me${path}`, {
    method: init.method ?? "POST",
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    // eslint-disable-next-line typescript/no-misused-spread -- HeadersInit spread; known to be plain object in tests
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

function authed(overrides: Record<string, unknown> = {}) {
  if ("error" in overrides && overrides.error != null) {
    mocks.state.authResult = {
      user: null,
      dbUser: null,
      db: null,
      env: null,
      captureBookmark: null,
      error: overrides.error,
    };
    return;
  }

  mocks.state.authResult = {
    user: { id: "user_1", email: "avery@example.com" },
    dbUser: { id: "user_1", handle: "avery" },
    db: mocks.db,
    env: mocks.env,
    captureBookmark: vi.fn(async () => undefined),
    error: null,
    ...overrides,
  };
}

describe("API route coverage", () => {
  let originalCronSecret: string | undefined;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-secret";
    vi.clearAllMocks();
    mocks.state.selectResults = [];
    mocks.state.authResult = null;
    mocks.state.handleRateLimit = { allowed: true };
    mocks.state.emailRateLimit = { allowed: true };
    mocks.state.uploadRateLimit = {
      allowed: true,
      remaining: { hourly: 9, daily: 49 },
    };
    mocks.state.disposableResult = { disposable: false };
    mocks.state.handleTaken = false;
    mocks.state.themeError = null;
    mocks.state.requestSize = { valid: true };
    mocks.state.adminAuthResult = {
      user: { id: "admin_1", email: "admin@example.com", name: "Admin", isAdmin: true },
      error: null,
    };
    mocks.state.cookieStore.value = null;
    mocks.db.query.user.findFirst.mockResolvedValue(null);
    mocks.db.query.siteData.findFirst.mockResolvedValue(null);
    mocks.db.query.resumes.findFirst.mockResolvedValue(null);
    mocks.env.CLICKFOLIO_DB.prepare.mockReturnValue({ first: vi.fn(async () => ({ ok: 1 })) });
    mocks.env.CLICKFOLIO_R2_BUCKET.list.mockResolvedValue({ objects: [] });
    mocks.r2Put.mockResolvedValue(undefined);
    mocks.r2Delete.mockResolvedValue(undefined);
    mocks.r2GetAsUint8Array.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.resvgAsync.mockResolvedValue({
      render: () => ({
        asPng: () => new Uint8Array([137, 80, 78, 71]),
      }),
    });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
    expect(mocks.state.selectResults).toEqual([]);
  });

  it("exercises handle availability validation and ownership branches", async () => {
    const { GET } = await import("@/app/api/handle/check/route");

    expect((await GET(new Request("https://clickfolio.me/api/handle/check"))).status).toBe(400);
    expect(
      (await GET(new Request("https://clickfolio.me/api/handle/check?handle=ab"))).status,
    ).toBe(400);
    expect(
      (await GET(new Request(`https://clickfolio.me/api/handle/check?handle=${"a".repeat(31)}`)))
        .status,
    ).toBe(400);
    expect(
      (await GET(new Request("https://clickfolio.me/api/handle/check?handle=bad_name"))).status,
    ).toBe(400);
    expect(
      (await GET(new Request("https://clickfolio.me/api/handle/check?handle=-bad"))).status,
    ).toBe(400);
    expect(
      (await GET(new Request("https://clickfolio.me/api/handle/check?handle=bad--name"))).status,
    ).toBe(400);

    expect(
      await (await GET(new Request("https://clickfolio.me/api/handle/check?handle=admin"))).json(),
    ).toEqual({ available: false, reason: "reserved" });

    mocks.state.handleRateLimit = { allowed: false, message: "slow down" };
    expect(
      (await GET(new Request("https://clickfolio.me/api/handle/check?handle=rate-test"))).status,
    ).toBe(429);

    mocks.state.handleRateLimit = { allowed: true };
    mocks.state.selectResults = [[]];
    expect(
      await (
        await GET(new Request("https://clickfolio.me/api/handle/check?handle=new-handle"))
      ).json(),
    ).toEqual({ available: true });

    mocks.state.selectResults = [[{ id: "user_1" }]];
    expect(
      await (await GET(new Request("https://clickfolio.me/api/handle/check?handle=avery"))).json(),
    ).toEqual({ available: true, isCurrentHandle: true });

    mocks.state.selectResults = [[{ id: "other_user" }]];
    expect(
      await (await GET(new Request("https://clickfolio.me/api/handle/check?handle=taken"))).json(),
    ).toEqual({ available: false });
  });

  it("validates disposable email requests and fails open on service errors", async () => {
    const { POST } = await import("@/app/api/email/validate/route");

    expect((await POST(new Request("https://clickfolio.me/api/email/validate"))).status).toBe(400);
    expect((await POST(jsonRequest("/api/email/validate", { email: "bad" }))).status).toBe(400);

    mocks.state.emailRateLimit = { allowed: false, message: "too many" };
    expect(
      (await POST(jsonRequest("/api/email/validate", { email: "a@example.com" }))).status,
    ).toBe(429);

    mocks.state.emailRateLimit = { allowed: true };
    mocks.state.disposableResult = { disposable: true };
    expect(
      await (await POST(jsonRequest("/api/email/validate", { email: "a@example.com" }))).json(),
    ).toEqual({ valid: false, reason: "Please use a permanent email address" });

    mocks.state.disposableResult = { disposable: false };
    expect(
      await (await POST(jsonRequest("/api/email/validate", { email: "a@example.com" }))).json(),
    ).toEqual({ valid: true });
  });

  it("aggregates analytics across current and historical handles", async () => {
    const { GET } = await import("@/app/api/analytics/stats/route");
    authed();

    expect(
      (await GET(new Request("https://clickfolio.me/api/analytics/stats?period=bad"))).status,
    ).toBe(400);

    authed({ dbUser: { id: "user_1", handle: null } });
    expect(
      await (await GET(new Request("https://clickfolio.me/api/analytics/stats?period=7d"))).json(),
    ).toMatchObject({ totalViews: 0, period: "7d" });

    authed();
    mocks.state.selectResults = [[{ oldHandle: "old-one" }, { oldHandle: null }]];
    const response = await GET(new Request("https://clickfolio.me/api/analytics/stats?period=30d"));
    const body = (await response.json()) as { viewsByDay: unknown[] } & Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalViews: 20,
      uniqueVisitors: 8,
      topReferrers: [{ referrer: "linkedin.com", count: 6 }],
      directVisits: 14,
      period: "30d",
    });
    expect(body.viewsByDay).toHaveLength(30);

    mocks.getStats.mockRejectedValueOnce(new Error("umami down"));
    mocks.state.selectResults = [[]];
    expect((await GET(new Request("https://clickfolio.me/api/analytics/stats"))).status).toBe(503);
  });

  it("returns site data and user stats for authenticated users", async () => {
    const siteDataRoute = await import("@/app/api/site-data/route");
    const userStatsRoute = await import("@/app/api/user/stats/route");

    authed({ error: new Response("nope", { status: 401 }) });
    expect((await siteDataRoute.GET()).status).toBe(401);
    expect((await userStatsRoute.GET()).status).toBe(401);

    authed();
    mocks.state.selectResults = [[]];
    expect(await (await siteDataRoute.GET()).json()).toBeNull();

    authed();
    mocks.state.selectResults = [
      [
        {
          id: "site_1",
          userId: "user_1",
          resumeId: "res_1",
          content: '{"full_name":"Avery"}',
          themeId: "minimalist_editorial",
          lastPublishedAt: "2026-05-20T00:00:00Z",
          createdAt: "2026-05-20T00:00:00Z",
          updatedAt: "2026-05-20T00:00:00Z",
        },
      ],
    ];
    expect(await (await siteDataRoute.GET()).json()).toMatchObject({
      id: "site_1",
      content: { full_name: "Avery" },
    });

    authed();
    mocks.db.query.user.findFirst.mockResolvedValueOnce(null);
    expect((await userStatsRoute.GET()).status).toBe(404);

    authed();
    mocks.db.query.user.findFirst.mockResolvedValueOnce({ referralCount: 5, isPro: true });
    expect(await (await userStatsRoute.GET()).json()).toEqual({ referralCount: 5, isPro: true });
  });

  it("tracks referrals without leaking validation or storage failures", async () => {
    const { POST } = await import("@/app/api/referral/track/route");

    expect((await POST(new Request("https://clickfolio.me/api/referral/track"))).status).toBe(204);
    expect((await POST(jsonRequest("/api/referral/track", {}))).status).toBe(204);
    expect((await POST(jsonRequest("/api/referral/track", { code: "x".repeat(65) }))).status).toBe(
      204,
    );
    expect(
      (
        await POST(
          jsonRequest(
            "/api/referral/track",
            { code: "avery" },
            { headers: { "user-agent": "Googlebot/2.1" } },
          ),
        )
      ).status,
    ).toBe(204);

    mocks.state.selectResults = [[]];
    expect(
      (
        await POST(
          jsonRequest(
            "/api/referral/track",
            { handle: "avery", source: "bad" },
            { headers: { "user-agent": "Mozilla/5.0 Test Browser" } },
          ),
        )
      ).status,
    ).toBe(204);

    mocks.state.selectResults = [[{ id: "user_2" }]];
    expect(
      (
        await POST(
          jsonRequest(
            "/api/referral/track",
            { code: "ABC123", source: "share" },
            { headers: { "user-agent": "Mozilla/5.0 Test Browser" } },
          ),
        )
      ).status,
    ).toBe(204);
    expect(mocks.db.insert).toHaveBeenCalled();
  });

  it("manages pending upload cookies with signed values", async () => {
    const { POST, GET, DELETE } = await import("@/app/api/upload/pending/route");

    expect((await POST(jsonRequest("/api/upload/pending", { key: "bad/key" }))).status).toBe(400);

    expect(
      (await POST(jsonRequest("/api/upload/pending", { key: "temp/upload.pdf" }))).status,
    ).toBe(200);
    expect(mocks.state.cookieStore.set).toHaveBeenCalled();
    expect(await (await GET()).json()).toEqual({ key: "temp/upload.pdf" });

    mocks.state.cookieStore.value = "not-a-valid-cookie";
    expect(await (await GET()).json()).toEqual({ key: null });

    expect((await DELETE()).status).toBe(200);
    expect(mocks.state.cookieStore.delete).toHaveBeenCalled();
  });

  it("validates direct uploads before storing PDFs in R2", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const originalBucket = mocks.env.CLICKFOLIO_R2_BUCKET;
    const pdf = new Uint8Array(120);
    pdf.set([0x25, 0x50, 0x44, 0x46]); // %PDF

    const uploadRequest = (overrides: { headers?: HeadersInit; body?: BodyInit } = {}) =>
      new Request("https://clickfolio.me/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/pdf",
          "content-length": String(
            (overrides.body as Uint8Array | undefined)?.byteLength ?? pdf.byteLength,
          ),
          "x-filename": "resume.pdf",
          // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
          // eslint-disable-next-line typescript/no-misused-spread -- HeadersInit spread; known to be plain object in tests
          ...(overrides.headers ?? {}),
        },
        body: overrides.body ?? pdf,
      });

    (mocks.env as { CLICKFOLIO_R2_BUCKET?: unknown }).CLICKFOLIO_R2_BUCKET = undefined;
    expect((await POST(uploadRequest())).status).toBe(503);
    mocks.env.CLICKFOLIO_R2_BUCKET = originalBucket;

    expect(
      (
        await POST(
          uploadRequest({
            headers: { "content-type": "text/plain" },
          }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(uploadRequest({ headers: { "content-length": "" } }))).status).toBe(411);
    expect((await POST(uploadRequest({ headers: { "content-length": "nope" } }))).status).toBe(400);
    expect((await POST(uploadRequest({ headers: { "content-length": "20000000" } }))).status).toBe(
      413,
    );
    expect(
      (await POST(uploadRequest({ headers: { "content-length": "10" }, body: pdf.slice(0, 10) })))
        .status,
    ).toBe(400);
    expect((await POST(uploadRequest({ headers: { "x-filename": "" } }))).status).toBe(400);
    expect(
      (await POST(uploadRequest({ headers: { "x-filename": `${"a".repeat(256)}.pdf` } }))).status,
    ).toBe(400);

    mocks.state.uploadRateLimit = {
      allowed: false,
      message: "too many uploads",
      remaining: { hourly: 0, daily: 0 },
    };
    expect((await POST(uploadRequest())).status).toBe(429);

    mocks.state.uploadRateLimit = {
      allowed: true,
      remaining: { hourly: 9, daily: 49 },
    };
    expect((await POST(uploadRequest({ headers: { "content-length": "121" } }))).status).toBe(400);

    const invalidPdf = new Uint8Array(120);
    expect((await POST(uploadRequest({ body: invalidPdf }))).status).toBe(400);

    mocks.r2Put.mockRejectedValueOnce(new Error("r2 down"));
    expect((await POST(uploadRequest())).status).toBe(500);

    const success = await POST(uploadRequest());
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({
      remaining: { hourly: 9, daily: 49 },
    });
    expect(mocks.r2Put).toHaveBeenLastCalledWith(
      originalBucket,
      expect.stringMatching(/^temp\//),
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: "application/pdf",
        customMetadata: expect.objectContaining({ originalFilename: "resume.pdf" }),
      }),
    );
    expect(success.headers.get("X-RateLimit-Remaining-Hourly")).toBe("9");
    expect(success.headers.get("Set-Cookie")).toContain("pending_upload=");
  });

  it("deletes account data, clears auth cookies, and reports partial storage warnings", async () => {
    const { POST } = await import("@/app/api/account/delete/route");
    const originalBucket = mocks.env.CLICKFOLIO_R2_BUCKET;

    authed({ error: new Response("auth", { status: 401 }) });
    expect(
      (await POST(jsonRequest("/api/account/delete", { confirmation: "avery@example.com" })))
        .status,
    ).toBe(401);

    authed();
    (mocks.env as { CLICKFOLIO_R2_BUCKET?: unknown }).CLICKFOLIO_R2_BUCKET = undefined;
    expect(
      (await POST(jsonRequest("/api/account/delete", { confirmation: "avery@example.com" })))
        .status,
    ).toBe(500);
    mocks.env.CLICKFOLIO_R2_BUCKET = originalBucket;

    authed();
    expect(
      (
        await POST(
          new Request("https://clickfolio.me/api/account/delete", { method: "POST", body: "{" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(jsonRequest("/api/account/delete", { confirmation: "not-an-email" }))).status,
    ).toBe(400);
    expect(
      (await POST(jsonRequest("/api/account/delete", { confirmation: "wrong@example.com" })))
        .status,
    ).toBe(400);

    authed();
    mocks.state.selectResults = [[{ r2Key: "one.pdf" }, { r2Key: null }, { r2Key: "two.pdf" }]];
    mocks.r2Delete
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockResolvedValueOnce(undefined);
    const success = await POST(
      jsonRequest("/api/account/delete", { confirmation: "AVERY@EXAMPLE.COM" }),
    );

    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({
      success: true,
      warnings: [{ type: "r2", message: "Failed to delete file: one.pdf" }],
    });
    expect(mocks.r2Delete).toHaveBeenCalledWith(originalBucket, "one.pdf");
    expect(mocks.r2Delete).toHaveBeenCalledWith(originalBucket, "two.pdf");
    expect(mocks.db.batch).toHaveBeenCalled();
    expect(success.headers.get("Set-Cookie")).toContain("better-auth.session_token=");

    authed();
    mocks.state.selectResults = [[{ r2Key: "three.pdf" }]];
    mocks.db.batch.mockRejectedValueOnce(new Error("db down"));
    expect(
      (await POST(jsonRequest("/api/account/delete", { confirmation: "avery@example.com" })))
        .status,
    ).toBe(500);
  });

  it("renders static and dynamic OG images with resilient fallbacks", async () => {
    const home = await import("@/app/api/og/home/route");
    const dynamic = await import("@/app/api/og/[handle]/route");

    const homeResponse = await home.GET();
    expect(homeResponse.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await homeResponse.text()).toContain("clickfolio");

    const emptyHandle = await dynamic.GET(new Request("https://clickfolio.me/api/og/"), {
      params: Promise.resolve({ handle: "" }),
    });
    expect(emptyHandle.headers.get("Content-Type")).toBe("image/png");

    mocks.state.selectResults = [[]];
    const missing = await dynamic.GET(new Request("https://clickfolio.me/api/og/missing"), {
      params: Promise.resolve({ handle: "missing" }),
    });
    expect(missing.headers.get("Content-Type")).toBe("image/png");

    mocks.state.selectResults = [
      [
        {
          name: "Avery & Quinn",
          handle: "avery",
          previewName: "Avery <Lead>",
          previewHeadline: "Builds > ships",
          previewSkills: JSON.stringify(["TypeScript", "Cloudflare", "D1", "R2", "Hidden"]),
        },
      ],
    ];
    const profile = await dynamic.GET(new Request("https://clickfolio.me/api/og/%40avery"), {
      params: Promise.resolve({ handle: "%40avery" }),
    });
    expect(profile.headers.get("Content-Type")).toBe("image/png");
    expect(mocks.resvgAsync).toHaveBeenLastCalledWith(
      expect.stringContaining("Avery &lt;Lead&gt;"),
      expect.any(Object),
    );
    expect(mocks.resvgAsync.mock.calls.at(-1)?.[0]).not.toContain("Hidden");

    mocks.resvgAsync.mockRejectedValueOnce(new Error("wasm failed"));
    mocks.state.selectResults = [
      [
        {
          name: "Broken Renderer",
          handle: "broken",
          previewName: null,
          previewHeadline: null,
          previewSkills: null,
        },
      ],
    ];
    const fallback = await dynamic.GET(new Request("https://clickfolio.me/api/og/broken"), {
      params: Promise.resolve({ handle: "broken" }),
    });
    expect(fallback.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("summarizes admin referrals including empty, unknown, and attributed branches", async () => {
    const { GET } = await import("@/app/api/admin/referrals/route");

    mocks.state.adminAuthResult = { user: null, error: new Response("admin", { status: 403 }) };
    expect((await GET()).status).toBe(403);

    mocks.state.adminAuthResult = {
      user: { id: "admin_1", email: "admin@example.com", name: "Admin", isAdmin: true },
      error: null,
    };
    mocks.state.selectResults = [
      [{ count: 2 }],
      [{ totalClicks: 10, uniqueClicks: 5, attributedConversions: 2 }],
      [{ count: 3 }],
      [
        { source: "share", count: 7 },
        { source: null, count: 3 },
      ],
      [
        { userId: "user_1", handle: "avery", referralCount: 3 },
        { userId: "user_2", handle: null, referralCount: 1 },
      ],
      [
        {
          newUserEmail: null,
          referrerUserId: "user_1",
          referredAt: null,
          createdAt: "2026-05-20T00:00:00Z",
        },
      ],
      [{ referrerUserId: "user_1", clicks: 6 }],
      [{ id: "user_1", handle: "avery" }],
    ];

    const body = (await (await GET()).json()) as {
      stats: unknown;
      topReferrers: unknown;
      sources: unknown;
      recentConversions: unknown;
    };
    expect(body.stats).toMatchObject({
      totalReferrers: 2,
      totalClicks: 10,
      conversions: 3,
      conversionRate: 60,
      attributedConversions: 2,
      attributedConversionRate: 40,
      unattributedConversions: 1,
    });
    expect(body.topReferrers).toEqual([
      { handle: "avery", clicks: 6, conversions: 3, rate: "50.0" },
      { handle: "unknown", clicks: 0, conversions: 1, rate: "0" },
    ]);
    expect(body.sources).toEqual([
      { source: "share", percent: 70 },
      { source: "unknown", percent: 30 },
    ]);
    expect(body.recentConversions).toEqual([
      {
        newUserEmail: "Unknown",
        referrerHandle: "avery",
        createdAt: "2026-05-20T00:00:00Z",
      },
    ]);

    mocks.db.select.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    expect((await GET()).status).toBe(500);
  });

  it("paginates admin users with search escaping and derived status labels", async () => {
    const { GET } = await import("@/app/api/admin/users/route");

    mocks.state.selectResults = [[{ count: 0 }], []];
    expect(
      await (await GET(new Request("https://clickfolio.me/api/admin/users?page=-3"))).json(),
    ).toEqual({ users: [], total: 0, page: 1, pageSize: 25 });

    mocks.state.selectResults = [
      [{ count: 4 }],
      [
        {
          id: "failed",
          name: "Failed User",
          email: "failed@example.com",
          handle: "failed",
          createdAt: "2026-05-20",
          isPro: false,
        },
        {
          id: "processing",
          name: "Processing User",
          email: "processing@example.com",
          handle: "processing",
          createdAt: "2026-05-19",
          isPro: false,
        },
        {
          id: "live",
          name: "Live User",
          email: "live@example.com",
          handle: "live",
          createdAt: "2026-05-18",
          isPro: true,
        },
        {
          id: "empty",
          name: "Empty User",
          email: "empty@example.com",
          handle: null,
          createdAt: "2026-05-17",
          isPro: false,
        },
      ],
      [
        { userId: "failed", status: "completed" },
        { userId: "failed", status: "failed" },
        { userId: "processing", status: "queued" },
      ],
      [{ userId: "live" }],
    ];

    const body = (await (
      await GET(new Request("https://clickfolio.me/api/admin/users?page=2&search=a%25_%5C"))
    ).json()) as { page: number; users: Array<{ status: string }> };
    expect(body.page).toBe(2);
    expect(body.users.map((entry: { status: string }) => entry.status)).toEqual([
      "failed",
      "processing",
      "live",
      "no_resume",
    ]);

    mocks.db.select.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    expect((await GET(new Request("https://clickfolio.me/api/admin/users"))).status).toBe(500);
  });

  it("filters admin resumes and folds internal statuses into dashboard buckets", async () => {
    const { GET } = await import("@/app/api/admin/resumes/route");

    expect(
      (await GET(new Request("https://clickfolio.me/api/admin/resumes?status=bad"))).status,
    ).toBe(400);

    mocks.state.selectResults = [
      [
        { status: "completed", count: 2 },
        { status: "waiting_for_cache", count: 1 },
        { status: "processing", count: 3 },
        { status: "queued", count: 4 },
        { status: "pending_claim", count: 5 },
        { status: "failed", count: 6 },
        { status: "unknown", count: 7 },
      ],
      [{ count: 1 }],
      [
        {
          id: "resume_1",
          userId: "user_1",
          status: "failed",
          retryCount: 2,
          totalAttempts: 4,
          lastAttemptError: null,
          errorMessage: "Parse failed",
          queuedAt: null,
          updatedAt: null,
          createdAt: "2026-05-20",
          userEmail: null,
        },
      ],
    ];

    const body = (await (
      await GET(new Request("https://clickfolio.me/api/admin/resumes?status=failed&page=2"))
    ).json()) as { stats: unknown; resumes: unknown; page: number };
    expect(body.stats).toEqual({ completed: 3, processing: 3, queued: 9, failed: 6 });
    expect(body.resumes).toEqual([
      {
        id: "resume_1",
        userEmail: "Unknown",
        status: "failed",
        retryCount: 2,
        totalAttempts: 4,
        lastAttemptError: "Parse failed",
        updatedAt: "2026-05-20",
      },
    ]);
    expect(body.page).toBe(2);

    mocks.db.select.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    expect((await GET(new Request("https://clickfolio.me/api/admin/resumes"))).status).toBe(500);
  });

  it("combines admin dashboard stats with Umami sparkline data", async () => {
    const { GET } = await import("@/app/api/admin/stats/route");

    mocks.state.selectResults = [
      [{ total: 8 }],
      [{ count: 5 }],
      [
        { status: "processing", count: 2 },
        { status: "queued", count: 3 },
        { status: "failed", count: 1 },
        { status: null, count: 9 },
      ],
      [
        { email: "new@example.com", createdAt: "2026-05-20" },
        { email: "old@example.com", createdAt: "2026-05-19" },
      ],
    ];
    mocks.getStats.mockResolvedValueOnce({ pageviews: 12, visitors: 4 });
    mocks.getPageviews.mockResolvedValueOnce({
      pageviews: [{ x: new Date().toISOString(), y: 9 }],
      sessions: [],
    });

    const body = (await (await GET()).json()) as {
      dailyViews: Array<{ views: number }>;
    } & Record<string, unknown>;
    expect(body).toMatchObject({
      totalUsers: 8,
      publishedResumes: 5,
      processingResumes: 5,
      viewsToday: 12,
      failedResumes: 1,
      recentSignups: [
        { email: "new@example.com", createdAt: "2026-05-20" },
        { email: "old@example.com", createdAt: "2026-05-19" },
      ],
    });
    expect(body.dailyViews).toHaveLength(7);
    expect(body.dailyViews.at(-1)?.views).toBe(9);

    mocks.getStats.mockRejectedValueOnce(new Error("umami down"));
    expect((await GET()).status).toBe(503);
  });

  it("completes wizard onboarding and handles validation failures", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");
    const validBody = {
      handle: "avery",
      privacy_settings: {
        show_phone: true,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      },
      theme_id: "minimalist_editorial",
    };

    mocks.state.requestSize = { valid: false, error: "too large" };
    expect((await POST(jsonRequest("/api/wizard/complete", validBody))).status).toBe(413);

    mocks.state.requestSize = { valid: true };
    authed({ error: new Response("auth", { status: 401 }) });
    expect((await POST(jsonRequest("/api/wizard/complete", validBody))).status).toBe(401);

    authed();
    expect(
      (await POST(new Request("https://clickfolio.me/api/wizard/complete", { method: "POST" })))
        .status,
    ).toBe(400);
    expect(
      (await POST(jsonRequest("/api/wizard/complete", { ...validBody, handle: "x" }))).status,
    ).toBe(400);

    mocks.state.themeError = new Response("locked", { status: 403 });
    expect((await POST(jsonRequest("/api/wizard/complete", validBody))).status).toBe(403);

    mocks.state.themeError = null;
    mocks.state.handleTaken = true;
    expect((await POST(jsonRequest("/api/wizard/complete", validBody))).status).toBe(400);

    mocks.state.handleTaken = false;
    expect(await (await POST(jsonRequest("/api/wizard/complete", validBody))).json()).toMatchObject(
      {
        success: true,
        handle: "avery",
      },
    );

    mocks.db.batch.mockRejectedValueOnce(new Error("UNIQUE constraint failed: user.handle"));
    expect((await POST(jsonRequest("/api/wizard/complete", validBody))).status).toBe(409);
  });

  it("covers health, client-error, cron, and auth wrappers", async () => {
    const health = await import("@/app/api/health/route");
    const clientError = await import("@/app/api/client-error/route");
    const auth = await import("@/app/api/auth/[...all]/route");
    const cleanup = await import("@/app/api/cron/cleanup/route");
    const cleanupR2 = await import("@/app/api/cron/cleanup-r2/route");
    const syncDomains = await import("@/app/api/cron/sync-domains/route");
    const recover = await import("@/app/api/cron/recover-orphaned/route");

    expect((await health.GET()).status).toBe(200);
    mocks.env.CLICKFOLIO_DB.prepare.mockReturnValueOnce({
      first: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect((await health.GET()).status).toBe(503);

    expect(
      (await clientError.POST(new Request("https://clickfolio.me/api/client-error"))).status,
    ).toBe(204);
    expect((await clientError.POST(jsonRequest("/api/client-error", { message: 1 }))).status).toBe(
      204,
    );
    expect(
      (
        await clientError.POST(
          jsonRequest("/api/client-error", {
            message: "boom".repeat(400),
            stack: "stack",
            componentStack: "component",
            url: "https://clickfolio.me/dashboard",
          }),
        )
      ).status,
    ).toBe(204);

    expect((await auth.GET(new Request("https://clickfolio.me/api/auth/session"))).status).toBe(
      200,
    );
    expect((await auth.POST(new Request("https://clickfolio.me/api/auth/signout"))).status).toBe(
      200,
    );

    const cronRequest = new Request("https://clickfolio.me/api/cron/cleanup", {
      headers: { Authorization: "Bearer cron-secret" },
    });
    expect((await cleanup.GET(new Request("https://clickfolio.me/api/cron/cleanup"))).status).toBe(
      401,
    );
    expect(await (await cleanup.GET(cronRequest)).json()).toEqual({ deleted: 1 });
    expect(await (await cleanupR2.GET(cronRequest)).json()).toEqual({ deleted: 2 });
    expect(await (await syncDomains.GET(cronRequest)).json()).toEqual({ synced: 3 });
    expect(await (await recover.GET(cronRequest)).json()).toEqual({ recovered: 4 });
  });
});
