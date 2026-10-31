import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import handler from "@tanstack/react-start/server-entry";
import worker from "@/worker/index";
import { verifyToken } from "@clerk/backend";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect } from "effect";
import { HttpUpstreamFailed } from "@/lib/effect/failures";
import type { JsonValue } from "@/lib/types/json";
import { fakeBatch, fakeMessage } from "@/tests/helpers/queue";

vi.mock("cloudflare:workers", () => ({
  env: {},
  DurableObject: class DurableObject {
    constructor(_state: JsonValue, _env: JsonValue) {}
  },
}));

vi.mock("@/lib/durable-objects/resume-status", () => ({
  ClickfolioStatusDO: class ClickfolioStatusDO {
    constructor(_state: JsonValue, _env: JsonValue) {}
    async fetch(_req: Request) {
      return new Response("DO response");
    }
  },
}));

// Workflow classes extend `cloudflare:workers` WorkflowEntrypoint, which only exists
// in the Workers runtime; the worker just re-exports them.
vi.mock("@/lib/workflows/resume-parse-workflow", () => ({
  ResumeParseWorkflow: class ResumeParseWorkflow {},
}));

vi.mock("@/lib/workflows/r2-delete-workflow", () => ({
  R2DeleteWorkflow: class R2DeleteWorkflow {},
}));

// The cached-pages entrypoint extends `cloudflare:workers` WorkerEntrypoint; the worker only
// re-exports it and reaches it through `ctx.exports`.
vi.mock("@/worker/cached-pages", () => ({
  CachedPages: class CachedPages {},
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: vi.fn().mockResolvedValue(new Response("OK from handler", { status: 200 })),
  },
}));

const {
  mockVerifyToken,
  mockPerformCleanup,
  mockPerformStrandedSweep,
  mockDrainIndexNow,
  mockUserFindFirst,
  mockResumeFindFirst,
} = vi.hoisted(() => {
  const claims = {
    "jwt.for.clerk-user-1": { sub: "user_clerk_1", sid: "sess_1" },
    "jwt.for.clerk-other": { sub: "clerk_user_other", sid: "sess_2" },
  };

  return {
    // @clerk/backend rejects a bad token with a TokenVerificationError carrying a `reason`.
    mockVerifyToken: vi.fn(async (token: string, _options?: { secretKey?: string }) => {
      const found = Object.entries(claims).find(([known]) => known === token)?.[1];

      if (!found) throw Object.assign(new Error("invalid token"), { reason: "token-invalid" });

      return found;
    }),
    mockPerformCleanup: vi.fn(),
    mockPerformStrandedSweep: vi.fn(),
    mockDrainIndexNow: vi.fn(),
    mockUserFindFirst: vi.fn(),
    mockResumeFindFirst: vi.fn(),
  };
});

vi.mock("@clerk/backend", () => ({ verifyToken: mockVerifyToken }));

vi.mock("@/lib/cron/cleanup", () => ({
  performCleanup: mockPerformCleanup,
}));

vi.mock("@/lib/cron/stranded-resumes", () => ({
  performStrandedSweep: mockPerformStrandedSweep,
}));

vi.mock("@/lib/seo/indexnow-profiles", () => ({
  drainIndexNow: mockDrainIndexNow,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    query: {
      user: { findFirst: mockUserFindFirst },
      resumes: { findFirst: mockResumeFindFirst },
    },
  })),
}));

vi.mock("drizzle-orm", () => ({
  relations: vi.fn((_table, build) =>
    build({
      many: vi.fn((table) => ({ relation: "many", table })),
      one: vi.fn((table, config) => ({ relation: "one", table, config })),
    }),
  ),
  eq: vi.fn((_field, value) => ({ op: "eq", value })),
  and: vi.fn((...conds) => ({ op: "and", conds })),
  gt: vi.fn((_field, value) => ({ op: "gt", value })),
  gte: vi.fn((_field, value) => ({ op: "gte", value })),
  isNotNull: vi.fn((f) => ({ op: "isNotNull", f })),
  ne: vi.fn((_f, v) => ({ op: "ne", v })),
  or: vi.fn((...conds) => ({ op: "or", conds })),
  desc: vi.fn((f) => ({ op: "desc", f })),
  count: vi.fn(() => ({ op: "count" })),
  sql: Object.assign(
    vi.fn(() => ({ op: "sql" })),
    {
      join: vi.fn(() => ({ op: "sql.join" })),
    },
  ),
}));

function makeStatusDo() {
  const forward = vi.fn().mockResolvedValue(new Response("WS response"));

  const namespace: CloudflareEnv["CLICKFOLIO_STATUS_DO"] = {
    newUniqueId: vi.fn(),
    idFromName: vi.fn().mockReturnValue({ toString: () => "test-do-id" }),
    idFromString: vi.fn(),
    get: vi.fn().mockReturnValue({ fetch: forward }),
    getByName: vi.fn(),
    jurisdiction: vi.fn(),
  };

  return { namespace, forward };
}

function makeEnv(overrides: Partial<CloudflareEnv> = {}): CloudflareEnv {
  // SAFETY: makeEnv supplies only the bindings these worker tests exercise; the string
  // secrets and other CloudflareEnv bindings are absent by design and never read here.
  return {
    HYPERDRIVE: {
      connectionString: "postgres://user:pass@localhost:5432/clickfolio",
    } as CloudflareEnv["HYPERDRIVE"],
    CLICKFOLIO_R2_BUCKET: {} as R2Bucket,
    CLICKFOLIO_STATUS_DO: makeStatusDo().namespace,
    CLERK_SECRET_KEY: "sk_test_worker",
    APP_URL: "https://clickfolio.me",
    ...overrides,
  } as CloudflareEnv;
}

function makeCtx(cachedPagesFetch = (request: Request) => handler.fetch(request)) {
  // SAFETY: the worker only invokes waitUntil/passThroughOnException; props, tracing and
  // abort are runtime-only members these tests never read or call.
  const ctx = {
    waitUntil: (_promise: Promise<void>) => {},
    passThroughOnException: () => {},
  } as ExecutionContext;

  // Page reads go through the cached entrypoint; by default it renders, like a cache miss.
  return Object.assign(ctx, { exports: { CachedPages: { fetch: vi.fn(cachedPagesFetch) } } });
}

function makeWsRequest(
  headers: Record<string, string> = {},
  query = "?resume_id=res-123",
): Request {
  return new Request(`https://clickfolio.me/ws/resume-status${query}`, {
    headers: { Upgrade: "websocket", ...headers },
  });
}

function resetAll() {
  vi.clearAllMocks();
  mockUserFindFirst.mockReset();
  mockResumeFindFirst.mockReset();
  mockUserFindFirst.mockResolvedValue(null);
  mockResumeFindFirst.mockResolvedValue(null);
  mockPerformCleanup.mockResolvedValue({
    ok: true,
    deleted: { rateLimits: 1, handleChanges: 0 },
    timestamp: new Date().toISOString(),
  });
  mockPerformStrandedSweep.mockResolvedValue({ neverStarted: 0, timedOut: 0 });
  mockDrainIndexNow.mockReturnValue(Effect.void);
}

describe("Worker fetch handler", () => {
  beforeEach(resetAll);

  it("adds security headers to non-WebSocket responses", async () => {
    const env = makeEnv();
    const request = new Request("https://clickfolio.me/dashboard");

    const response = await worker.fetch(request, env, makeCtx());

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // Pins the unified SECURITY_HEADERS (worker imports the API-layer constant).
    // A future divergence between the two copies must fail here. See issue #172.
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(response.headers.get("X-XSS-Protection")).toBe("0");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("renders pages through the cached entrypoint and reports its cache status", async () => {
    const ctx = makeCtx(
      async () =>
        new Response("cached", {
          headers: {
            "cf-cache-status": "HIT",
            "Cloudflare-CDN-Cache-Control": "s-maxage=300",
            "Cache-Tag": "edge-0123456789abcdef0123456789abcdef",
          },
        }),
    );

    const response = await worker.fetch(
      new Request("https://clickfolio.me/@alice"),
      makeEnv(),
      ctx,
    );

    expect(await response.text()).toBe("cached");
    expect(response.headers.get("x-edge-cache")).toBe("HIT");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBeNull();
    expect(response.headers.get("Cache-Tag")).toBeNull();
    expect(vi.mocked(handler.fetch)).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/health"],
    ["GET", "/_serverFn/abc"],
    ["POST", "/dashboard"],
  ])("sends %s %s straight to the app, never the cache", async (method, path) => {
    const ctx = makeCtx();
    const request = new Request(`https://clickfolio.me${path}`, { method });

    await worker.fetch(request, makeEnv(), ctx);

    expect(ctx.exports.CachedPages.fetch).not.toHaveBeenCalled();
    expect(vi.mocked(handler.fetch)).toHaveBeenLastCalledWith(request);
  });

  it.each([
    ["/otel", 404],
    ["/otel/v1/traces", 405],
    ["/otel/anything", 404],
  ])("answers %s from the ingest proxy (%i), never the app", async (path, code) => {
    const response = await worker.fetch(
      new Request(`https://clickfolio.me${path}`),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(code);
    expect(vi.mocked(handler.fetch)).not.toHaveBeenCalled();
  });

  it("leaves look-alike paths such as /otelfoo to the app", async () => {
    await worker.fetch(new Request("https://clickfolio.me/otelfoo"), makeEnv(), makeCtx());

    expect(vi.mocked(handler.fetch)).toHaveBeenCalled();
  });

  it("returns 400 for WebSocket upgrade missing resume_id", async () => {
    const env = makeEnv();

    const response = await worker.fetch(makeWsRequest({}, ""), env, makeCtx());

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Missing resume_id query parameter");
  });

  it("returns 401 for WebSocket upgrade with no session token", async () => {
    const env = makeEnv();

    const response = await worker.fetch(makeWsRequest(), env, makeCtx());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Invalid session");
  });

  it("returns 401 when the Clerk token fails verification", async () => {
    const env = makeEnv();

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=tampered-or-expired-jwt" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Invalid session");
    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith(
      "tampered-or-expired-jwt",
      expect.anything(),
    );
  });

  it("treats an undecodable __session cookie as no session instead of throwing", async () => {
    const response = await worker.fetch(
      makeWsRequest({ Cookie: "theme=dark; __session=%E0%A4%A" }),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Invalid session");
    expect(vi.mocked(verifyToken)).not.toHaveBeenCalled();
  });

  it("answers 503 when Clerk cannot be reached, not a sign-out and not a crash", async () => {
    // The SDK's own key-set fetch failing surfaces as a plain network error, not a token fault.
    vi.mocked(verifyToken).mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(503);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("answers 503 when the database lookup fails", async () => {
    mockUserFindFirst.mockRejectedValueOnce(new Error("connection reset"));

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(503);
  });

  it("answers 503 when the status Durable Object cannot be reached", async () => {
    const statusDo = makeStatusDo();
    statusDo.forward.mockRejectedValueOnce(new Error("object reset"));
    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue({ id: "res-123", userId: "pg-user-1" });

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      makeEnv({ CLICKFOLIO_STATUS_DO: statusDo.namespace }),
      makeCtx(),
    );

    expect(response.status).toBe(503);
    expect(statusDo.forward).toHaveBeenCalledTimes(1);
  });

  it("returns signed-out for an Authorization Bearer header without a __session cookie", async () => {
    const env = makeEnv();

    const response = await worker.fetch(
      makeWsRequest({ Authorization: "Bearer jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Invalid session");
    expect(vi.mocked(verifyToken)).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("uses only the __session cookie when an Authorization header is also present", async () => {
    const env = makeEnv();

    await worker.fetch(
      makeWsRequest({
        Cookie: "__session=jwt.for.clerk-user-1",
        Authorization: "Bearer jwt.for.clerk-other",
      }),
      env,
      makeCtx(),
    );

    expect(vi.mocked(verifyToken)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith("jwt.for.clerk-user-1", expect.anything());
  });

  it("returns 401 Unknown user for a valid token with no local PG user row", async () => {
    const env = makeEnv();

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Unknown user");
  });

  it("returns 404 when the resume does not exist", async () => {
    const env = makeEnv();
    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue(null);

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }, "?resume_id=missing-id"),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Resume not found");
  });

  it("returns 403 when the user does not own the resume", async () => {
    const env = makeEnv();
    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue({ id: "res-123", userId: "pg-user-2" });

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden: You don't own this resume");
  });

  it("returns 503 when STATUS_DO binding is missing", async () => {
    const env = makeEnv({
      CLICKFOLIO_STATUS_DO: undefined,
    });

    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue({ id: "res-123", userId: "pg-user-1" });

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("WebSocket not available");
  });

  it("forwards the upgrade to the DO keyed by resumeId with the PG user id header", async () => {
    const statusDo = makeStatusDo();
    const env = makeEnv({ CLICKFOLIO_STATUS_DO: statusDo.namespace });
    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue({ id: "res-123", userId: "pg-user-1" });

    const response = await worker.fetch(
      makeWsRequest({ Cookie: "__session=jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("WS response");
    expect(statusDo.namespace.idFromName).toHaveBeenCalledWith("res-123");
    expect(statusDo.forward).toHaveBeenCalledTimes(1);
    // SAFETY: forward is an untyped vi.fn() spy; the worker forwards the upgrade Request it received.
    const forwarded = statusDo.forward.mock.calls[0][0] as Request;
    expect(forwarded.headers.get("x-authenticated-user-id")).toBe("pg-user-1");
    expect(forwarded.headers.get("x-authenticated-user-id")).not.toBe("user_clerk_1");
  });
});

describe("Worker shared-cache privacy", () => {
  beforeEach(resetAll);

  it.each(["/@alice", "/@alice.md"])(
    "renders %s for a signed-in visitor without their session",
    async (path) => {
      const env = makeEnv({
        ASSETS: { fetch: vi.fn(async () => new Response(null, { status: 404 })), connect: vi.fn() },
      });

      const request = new Request(`https://clickfolio.me${path}`, {
        headers: { cookie: "__session=jwt.for.clerk-user-1", authorization: "Bearer jwt" },
      });

      await worker.fetch(request, env, makeCtx());

      const [forwarded] = vi.mocked(handler.fetch).mock.calls[0] ?? [];
      expect(forwarded?.headers.get("cookie")).toBeNull();
      expect(forwarded?.headers.get("authorization")).toBeNull();
      expect(new URL(forwarded?.url ?? "").pathname).toBe("/@alice");
    },
  );

  it("redirects /%40handle to /@handle so every cached copy shares one purgeable URL", async () => {
    const response = await worker.fetch(
      new Request("https://clickfolio.me/%40alice"),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://clickfolio.me/@alice");
    expect(vi.mocked(handler.fetch)).not.toHaveBeenCalled();
  });

  it("keeps the session for the dashboard", async () => {
    const request = new Request("https://clickfolio.me/dashboard", {
      headers: { cookie: "__session=jwt.for.clerk-user-1" },
    });

    await worker.fetch(request, makeEnv(), makeCtx());

    expect(vi.mocked(handler.fetch)).toHaveBeenLastCalledWith(request);
  });
});

describe("Worker edge purge consumer", () => {
  beforeEach(resetAll);

  it("purges the batch's tags through the cached entrypoint", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});

    const purge = vi.fn<(options: { tags: string[] }) => Promise<{ success: boolean }>>(
      async () => ({ success: true }),
    );

    // The consumer reads only ctx.exports.CachedPages.
    const ctx = Object.assign(makeCtx(), { exports: { CachedPages: { purge } } });

    const tags = ["edge-0123456789abcdef0123456789abcdef"];
    const message = fakeMessage("m1", { tags });

    const done = worker.queue(fakeBatch([message]), makeEnv(), ctx);

    await vi.runAllTimersAsync();
    await done;
    vi.useRealTimers();

    expect(purge).toHaveBeenCalledWith({ tags });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });
});

describe("Worker scheduled handler", () => {
  beforeEach(resetAll);

  function makeController(cron: string): ScheduledController {
    return {
      scheduledTime: Date.now(),
      cron,
      noRetry: vi.fn(),
    };
  }

  it("dispatches DB cleanup on '0 3 * * *' cron", async () => {
    const env = makeEnv();

    await worker.scheduled(makeController("0 3 * * *"), env);

    expect(mockPerformCleanup).toHaveBeenCalled();
  });

  it("dispatches the stranded-resume sweep on '*/15 * * * *' without running cleanup", async () => {
    const env = makeEnv();

    await worker.scheduled(makeController("*/15 * * * *"), env);

    expect(mockPerformStrandedSweep).toHaveBeenCalledWith(env);
    expect(mockPerformCleanup).not.toHaveBeenCalled();
  });

  it("drains due IndexNow submissions every minute without running other jobs", async () => {
    await worker.scheduled(makeController("* * * * *"), makeEnv());

    expect(mockDrainIndexNow).toHaveBeenCalledOnce();
    expect(mockPerformCleanup).not.toHaveBeenCalled();
    expect(mockPerformStrandedSweep).not.toHaveBeenCalled();
  });

  it("propagates an IndexNow refusal so the minute run is recorded as failed", async () => {
    const failure = new HttpUpstreamFailed({
      operation: "indexnow.submit",
      host: "indexnow",
      kind: "unavailable",
      message: "IndexNow request refused",
    });
    mockDrainIndexNow.mockReturnValueOnce(Effect.fail(failure));

    await expect(worker.scheduled(makeController("* * * * *"), makeEnv())).rejects.toBe(failure);
    expect(mockDrainIndexNow).toHaveBeenCalledOnce();
  });

  it("ignores the retired '0 2' cron (now R2 lifecycle + workflows)", async () => {
    const env = makeEnv();

    await worker.scheduled(makeController("0 2 * * *"), env);

    expect(mockPerformCleanup).not.toHaveBeenCalled();
    expect(mockPerformStrandedSweep).not.toHaveBeenCalled();
  });

  it("does not run the sweep on the daily cleanup cron", async () => {
    await worker.scheduled(makeController("0 3 * * *"), makeEnv());

    expect(mockPerformStrandedSweep).not.toHaveBeenCalled();
  });

  it("rethrows a sweep failure so the run is recorded as failed", async () => {
    mockPerformStrandedSweep.mockRejectedValueOnce(new Error("db down"));

    await expect(worker.scheduled(makeController("*/15 * * * *"), makeEnv())).rejects.toThrow(
      "db down",
    );
  });

  it("rethrows a cleanup failure so the run is recorded as failed", async () => {
    mockPerformCleanup.mockRejectedValueOnce(new Error("db down"));

    await expect(worker.scheduled(makeController("0 3 * * *"), makeEnv())).rejects.toThrow(
      "db down",
    );
  });

  it("does not throw on unknown cron expression", async () => {
    const env = makeEnv();

    await expect(worker.scheduled(makeController("0 12 * * MON"), env)).resolves.not.toThrow();
  });

  it("routes every cron trigger configured in wrangler.jsonc", async () => {
    const config = readFileSync(resolve(import.meta.dirname, "../../../wrangler.jsonc"), "utf8");

    const crons = [
      ...(/"crons"\s*:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? "").matchAll(/"([^"]+)"/g),
    ].map(([, cron]) => cron);

    expect(crons.length).toBeGreaterThan(0);

    for (const cron of crons) {
      vi.clearAllMocks();

      await worker.scheduled(makeController(cron), makeEnv());

      expect(
        mockPerformCleanup.mock.calls.length +
          mockPerformStrandedSweep.mock.calls.length +
          mockDrainIndexNow.mock.calls.length,
      ).toBe(1);
    }
  });
});
