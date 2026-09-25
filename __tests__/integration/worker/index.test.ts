import handler from "vinext/server/app-router-entry";
import worker from "@/worker/index";
import { verifyClerkToken } from "@/lib/auth/clerk";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

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

vi.mock("vinext/server/app-router-entry", () => ({
  default: {
    fetch: vi.fn().mockResolvedValue(new Response("OK from handler", { status: 200 })),
  },
}));

const { mockVerifyClerkToken, mockPerformCleanup, mockUserFindFirst, mockResumeFindFirst } =
  vi.hoisted(() => {
    const claims = {
      "jwt.for.clerk-user-1": { sub: "user_clerk_1", sid: "sess_1" },
      "jwt.for.clerk-other": { sub: "clerk_user_other", sid: "sess_2" },
    };

    return {
      mockVerifyClerkToken: vi.fn(
        async (token: string) =>
          Object.entries(claims).find(([known]) => known === token)?.[1] ?? null,
      ),
      mockPerformCleanup: vi.fn(),
      mockUserFindFirst: vi.fn(),
      mockResumeFindFirst: vi.fn(),
    };
  });

vi.mock("@/lib/auth/clerk", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  verifyClerkToken: mockVerifyClerkToken,
}));

vi.mock("@/lib/cron/cleanup", () => ({
  performCleanup: mockPerformCleanup,
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
    ...overrides,
  } as CloudflareEnv;
}

function makeCtx(): ExecutionContext {
  // SAFETY: the worker only invokes waitUntil/passThroughOnException; exports, props,
  // tracing, and abort are runtime-only members these tests never read or call.
  return {
    waitUntil: (_promise: Promise<void>) => {},
    passThroughOnException: () => {},
  } as ExecutionContext;
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

  it("passes env and ctx to vinext so onRequestError reports run under ctx.waitUntil", async () => {
    const env = makeEnv();
    const ctx = makeCtx();
    const request = new Request("https://clickfolio.me/dashboard");

    await worker.fetch(request, env, ctx);

    expect(vi.mocked(handler.fetch)).toHaveBeenLastCalledWith(request, env, ctx);
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
    expect(vi.mocked(verifyClerkToken)).toHaveBeenCalledWith("tampered-or-expired-jwt");
  });

  it("authenticates via the Authorization Bearer header", async () => {
    const env = makeEnv();
    mockUserFindFirst.mockResolvedValue({ id: "pg-user-1" });
    mockResumeFindFirst.mockResolvedValue({ id: "res-123", userId: "pg-user-1" });

    const response = await worker.fetch(
      makeWsRequest({ Authorization: "Bearer jwt.for.clerk-user-1" }),
      env,
      makeCtx(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("WS response");
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { op: "eq", value: "user_clerk_1" } }),
    );
  });

  it("prefers the __session cookie over an Authorization header when both are present", async () => {
    const env = makeEnv();

    await worker.fetch(
      makeWsRequest({
        Cookie: "__session=jwt.for.clerk-user-1",
        Authorization: "Bearer jwt.for.clerk-other",
      }),
      env,
      makeCtx(),
    );

    expect(vi.mocked(verifyClerkToken)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyClerkToken)).toHaveBeenCalledWith("jwt.for.clerk-user-1");
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

  it("ignores the retired '0 2' and '*/15' crons (now R2 lifecycle + workflows)", async () => {
    const env = makeEnv();

    await worker.scheduled(makeController("0 2 * * *"), env);
    await worker.scheduled(makeController("*/15 * * * *"), env);

    expect(mockPerformCleanup).not.toHaveBeenCalled();
  });

  it("does not throw on unknown cron expression", async () => {
    const env = makeEnv();

    await expect(worker.scheduled(makeController("0 12 * * MON"), env)).resolves.not.toThrow();
  });
});
