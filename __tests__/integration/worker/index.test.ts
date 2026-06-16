import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Integration tests for worker/index.ts
 *
 * Tests the worker's fetch (WebSocket auth gate), queue (message dispatch/ack/retry),
 * and scheduled (cron dispatch) handlers by importing the default export directly.
 *
 * Mocks all production dependencies so no real I/O occurs.
 */

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock cloudflare:workers to provide DurableObject base class (not available in Node.js/jsdom)
vi.mock("cloudflare:workers", () => ({
  env: {},
  DurableObject: class DurableObject {
    constructor(_state: unknown, _env: unknown) {}
  },
}));

// Mock the Durable Object export to avoid extending DurableObject in jsdom
vi.mock("@/lib/durable-objects/resume-status", () => ({
  ClickfolioStatusDO: class ClickfolioStatusDO {
    constructor(_state: unknown, _env: unknown) {}
    async fetch(_req: Request) {
      return new Response("DO response");
    }
  },
}));

vi.mock("vinext/server/app-router-entry", () => ({
  default: {
    fetch: vi.fn().mockResolvedValue(new Response("OK from handler", { status: 200 })),
  },
}));

const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn().mockImplementation(async () => ({
    api: { getSession: mockGetSession },
  })),
  getEnvValue: vi.fn((env: Record<string, string>, key: string) => env[key] || ""),
}));

const mockHandleQueueMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/queue/consumer", () => ({
  handleQueueMessage: mockHandleQueueMessage,
}));

const mockHandleDLQMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/queue/dlq-consumer", () => ({
  handleDLQMessage: mockHandleDLQMessage,
}));

const mockPerformCleanup = vi.fn().mockResolvedValue({ deleted: 1 });
vi.mock("@/lib/cron/cleanup", () => ({
  performCleanup: mockPerformCleanup,
}));

const mockPerformR2Cleanup = vi.fn().mockResolvedValue({ deleted: 2 });
const mockRetryPendingR2Deletions = vi.fn().mockResolvedValue({ retried: 0 });
vi.mock("@/lib/cron/cleanup-r2", () => ({
  performR2Cleanup: mockPerformR2Cleanup,
  retryPendingR2Deletions: mockRetryPendingR2Deletions,
}));

const mockSyncDisposableDomains = vi.fn().mockResolvedValue({ synced: 3 });
vi.mock("@/lib/cron/sync-disposable-domains", () => ({
  syncDisposableDomains: mockSyncDisposableDomains,
}));

const mockRecoverOrphanedResumes = vi.fn().mockResolvedValue({ recovered: 4 });
vi.mock("@/lib/cron/recover-orphaned", () => ({
  recoverOrphanedResumes: mockRecoverOrphanedResumes,
}));

const mockFindFirst = vi.fn();
const mockDb = {
  query: {
    resumes: {
      findFirst: mockFindFirst,
    },
  },
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  batch: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

vi.mock("@/lib/db/session", () => ({
  getSessionDbForWebhook: vi.fn().mockReturnValue({ db: mockDb }),
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

// ── Helpers ────────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<CloudflareEnv> = {}): CloudflareEnv {
  const doStub = {
    idFromName: vi.fn().mockReturnValue({ toString: () => "test-do-id" }),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response("WS response")),
    }),
  };

  return {
    CLICKFOLIO_DB: {} as D1Database,
    CLICKFOLIO_R2_BUCKET: {} as R2Bucket,
    CLICKFOLIO_PARSE_QUEUE: { send: vi.fn() } as unknown as Queue,
    CLICKFOLIO_STATUS_DO: doStub as unknown as DurableObjectNamespace,
    BETTER_AUTH_SECRET: "test-secret",
    ...overrides,
  } as CloudflareEnv;
}

function makeMessage(
  body: unknown,
  overrides: { ack?: ReturnType<typeof vi.fn>; retry?: ReturnType<typeof vi.fn> } = {},
) {
  return {
    id: crypto.randomUUID(),
    body,
    ack: overrides.ack ?? vi.fn(),
    retry: overrides.retry ?? vi.fn(),
  };
}

function makeBatch(queueName: string, messages: ReturnType<typeof makeMessage>[]) {
  return {
    queue: queueName,
    messages,
  } as unknown as MessageBatch<unknown>;
}

function makeCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

function resetAll() {
  vi.clearAllMocks();
  mockHandleQueueMessage.mockResolvedValue(undefined);
  mockHandleDLQMessage.mockResolvedValue(undefined);
  mockGetSession.mockResolvedValue(null);
  mockFindFirst.mockResolvedValue(null);
  mockPerformCleanup.mockResolvedValue({ deleted: 1 });
  mockPerformR2Cleanup.mockResolvedValue({ deleted: 2 });
  mockRetryPendingR2Deletions.mockResolvedValue({ retried: 0 });
  mockSyncDisposableDomains.mockResolvedValue({ synced: 3 });
  mockRecoverOrphanedResumes.mockResolvedValue({ recovered: 4 });
}

// ── Tests: fetch handler (WebSocket + security headers) ───────────────

describe("Worker fetch handler", () => {
  beforeEach(resetAll);

  it("adds security headers to non-WebSocket responses", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const request = new Request("https://clickfolio.me/dashboard");

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("returns 400 for WebSocket upgrade missing resume_id", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const request = new Request("https://clickfolio.me/ws/resume-status", {
      headers: { Upgrade: "websocket" },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(400);
  });

  it("returns 401 for WebSocket upgrade with no session cookie", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const request = new Request("https://clickfolio.me/ws/resume-status?resume_id=res-123", {
      headers: { Upgrade: "websocket" },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(401);
  });

  it("returns 401 for WebSocket upgrade with invalid session token", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    mockGetSession.mockResolvedValueOnce(null); // invalid session

    const request = new Request("https://clickfolio.me/ws/resume-status?resume_id=res-123", {
      headers: {
        Upgrade: "websocket",
        Cookie: "better-auth.session_token=bad-token",
      },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(401);
  });

  it("returns 404 for WebSocket upgrade when resume not found", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValueOnce(null); // resume not found

    const request = new Request("https://clickfolio.me/ws/resume-status?resume_id=missing-id", {
      headers: {
        Upgrade: "websocket",
        Cookie: "better-auth.session_token=valid-token",
      },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(404);
  });

  it("returns 403 for WebSocket upgrade when user does not own resume", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValueOnce({ id: "res-123", userId: "user-2" }); // different owner

    const request = new Request("https://clickfolio.me/ws/resume-status?resume_id=res-123", {
      headers: {
        Upgrade: "websocket",
        Cookie: "better-auth.session_token=valid-token",
      },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(403);
  });

  it("returns 503 when STATUS_DO binding is missing", async () => {
    const worker = await import("@/worker/index");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = makeEnv({ CLICKFOLIO_STATUS_DO: undefined as any });
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValueOnce({ id: "res-123", userId: "user-1" }); // owner match

    const request = new Request("https://clickfolio.me/ws/resume-status?resume_id=res-123", {
      headers: {
        Upgrade: "websocket",
        Cookie: "better-auth.session_token=valid-token",
      },
    });

    const response = await worker.default.fetch(request, env, makeCtx());

    expect(response.status).toBe(503);
  });
});

// ── Tests: queue handler (ack / retry / DLQ dispatch) ────────────────

describe("Worker queue handler", () => {
  beforeEach(resetAll);

  const VALID_BODY = {
    type: "parse",
    resumeId: "res-1",
    userId: "user-1",
    r2Key: "users/user-1/123/resume.pdf",
    fileHash: "a".repeat(64),
    attempt: 1,
  };

  it("acks malformed messages (invalid schema)", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const ack = vi.fn();
    const batch = makeBatch("clickfolio-parse-queue", [
      makeMessage({ type: "unknown", random: "data" }, { ack }),
    ]);

    await worker.default.queue(batch, env);

    expect(ack).toHaveBeenCalled();
    expect(mockHandleQueueMessage).not.toHaveBeenCalled();
  });

  it("acks valid main-queue messages after successful processing", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const ack = vi.fn();
    const batch = makeBatch("clickfolio-parse-queue", [makeMessage(VALID_BODY, { ack })]);

    await worker.default.queue(batch, env);

    expect(mockHandleQueueMessage).toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
  });

  it("retries message when handleQueueMessage throws a retryable error", async () => {
    const { QueueError, QueueErrorType } = await import("@/lib/queue/errors");
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const ack = vi.fn();
    const retry = vi.fn();

    mockHandleQueueMessage.mockRejectedValueOnce(
      new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "AI timeout"),
    );

    const batch = makeBatch("clickfolio-parse-queue", [makeMessage(VALID_BODY, { ack, retry })]);

    await worker.default.queue(batch, env);

    expect(retry).toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
  });

  it("acks (sends to DLQ) on permanent processing error", async () => {
    const { QueueError, QueueErrorType } = await import("@/lib/queue/errors");
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const ack = vi.fn();
    const retry = vi.fn();

    mockHandleQueueMessage.mockRejectedValueOnce(
      new QueueError(QueueErrorType.INVALID_PDF, "Bad PDF"),
    );

    const batch = makeBatch("clickfolio-parse-queue", [makeMessage(VALID_BODY, { ack, retry })]);

    await worker.default.queue(batch, env);

    expect(ack).toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("routes to DLQ handler for messages from the DLQ queue", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();
    const ack = vi.fn();
    const batch = makeBatch("clickfolio-parse-dlq", [makeMessage(VALID_BODY, { ack })]);

    await worker.default.queue(batch, env);

    expect(mockHandleDLQMessage).toHaveBeenCalled();
    expect(mockHandleQueueMessage).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
  });
});

// ── Tests: scheduled handler (cron dispatch) ─────────────────────────

describe("Worker scheduled handler", () => {
  beforeEach(resetAll);

  function makeController(cron: string): ScheduledController {
    return {
      scheduledTime: Date.now(),
      cron,
      noRetry: vi.fn(),
    };
  }

  it("dispatches R2 cleanup on '0 2 * * *' cron", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();

    await worker.default.scheduled(makeController("0 2 * * *"), env);

    expect(mockPerformR2Cleanup).toHaveBeenCalled();
    expect(mockRetryPendingR2Deletions).toHaveBeenCalled();
  });

  it("skips R2 cleanup when R2 binding is missing", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv({ CLICKFOLIO_R2_BUCKET: undefined as unknown as R2Bucket });

    await worker.default.scheduled(makeController("0 2 * * *"), env);

    expect(mockPerformR2Cleanup).not.toHaveBeenCalled();
  });

  it("dispatches DB cleanup on '0 3 * * *' cron", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();

    await worker.default.scheduled(makeController("0 3 * * *"), env);

    expect(mockPerformCleanup).toHaveBeenCalled();
  });

  it("dispatches disposable domain sync on '0 4 * * *' cron", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv({
      CLICKFOLIO_DISPOSABLE_DOMAINS: {
        get: vi.fn(),
        put: vi.fn(),
      } as unknown as KVNamespace,
    });

    await worker.default.scheduled(makeController("0 4 * * *"), env);

    expect(mockSyncDisposableDomains).toHaveBeenCalled();
  });

  it("skips domain sync when KV binding is missing", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv({ CLICKFOLIO_DISPOSABLE_DOMAINS: undefined as unknown as KVNamespace });

    await worker.default.scheduled(makeController("0 4 * * *"), env);

    expect(mockSyncDisposableDomains).not.toHaveBeenCalled();
  });

  it("dispatches orphan recovery on '*/15 * * * *' cron", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();

    await worker.default.scheduled(makeController("*/15 * * * *"), env);

    expect(mockRecoverOrphanedResumes).toHaveBeenCalled();
  });

  it("skips orphan recovery when queue binding is missing", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv({ CLICKFOLIO_PARSE_QUEUE: undefined as unknown as Queue });

    await worker.default.scheduled(makeController("*/15 * * * *"), env);

    expect(mockRecoverOrphanedResumes).not.toHaveBeenCalled();
  });

  it("does not throw on unknown cron expression", async () => {
    const worker = await import("@/worker/index");
    const env = makeEnv();

    await expect(
      worker.default.scheduled(makeController("0 12 * * MON"), env),
    ).resolves.not.toThrow();
  });
});
