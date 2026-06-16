/**
 * Focused tests for the pending-R2-deletion path introduced by plan 008.
 *
 * Verifies that:
 * - When an R2 delete fails during account deletion, a `pendingR2Deletions`
 *   row is inserted BEFORE the DB batch (so the key isn't lost if the batch fails).
 * - The DB batch (account deletion) still proceeds even when R2 fails.
 * - When all R2 deletes succeed, no pending row is inserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const state = {
    selectResults: [] as unknown[][],
    authResult: null as unknown,
    insertCalls: [] as unknown[],
  };

  const nextSelectResult = () => {
    if (state.selectResults.length === 0) {
      throw new Error("No select result queued");
    }
    return state.selectResults.shift() as unknown[];
  };

  const insertChain = {
    values: vi.fn((rows: unknown) => {
      state.insertCalls.push(rows);
      return Promise.resolve(undefined);
    }),
  };

  const createChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
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
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => createChain()),
    delete: vi.fn(() => createChain()),
    batch: vi.fn(async () => undefined),
  };

  const env = {
    CLICKFOLIO_DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })) },
    CLICKFOLIO_R2_BUCKET: { list: vi.fn(async () => ({ objects: [] })) },
    CLICKFOLIO_DISPOSABLE_DOMAINS: { get: vi.fn(async () => "[]") },
    CLICKFOLIO_PARSE_QUEUE: { send: vi.fn(async () => undefined) },
    BETTER_AUTH_SECRET: "test-secret-key",
    CF_AI_GATEWAY_ACCOUNT_ID: "acct",
    CF_AI_GATEWAY_ID: "gateway",
    CF_AIG_AUTH_TOKEN: "token",
  };

  const r2Delete = vi.fn(async () => undefined);

  return { state, db, env, insertChain, r2Delete };
});

vi.mock("cloudflare:workers", () => ({
  env: mocks.env,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(async () => ({
    api: { getSession: vi.fn(async () => ({ user: { id: "user_1" } })) },
  })),
  getEnvValue: vi.fn((env: Record<string, string>, key: string) => env[key] || "fallback-secret"),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(async () => mocks.state.authResult),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mocks.db),
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn((env: typeof mocks.env) => env.CLICKFOLIO_R2_BUCKET),
  R2: {
    put: vi.fn(async () => undefined),
    delete: mocks.r2Delete,
    getAsUint8Array: vi.fn(async () => new Uint8Array([1, 2, 3])),
    head: vi.fn(async () => ({ exists: true })),
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

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://clickfolio.me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authed(overrides: Record<string, unknown> = {}) {
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

describe("account delete — pending R2 deletion tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.selectResults = [];
    mocks.state.insertCalls = [];
    mocks.state.authResult = null;
    mocks.db.batch.mockResolvedValue(undefined);
    mocks.r2Delete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    expect(mocks.state.selectResults).toEqual([]);
  });

  it("inserts a pending deletion row when an R2 delete fails, and still deletes the account", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [[{ r2Key: "users/user-1/resume.pdf" }, { r2Key: null }]];
    mocks.r2Delete.mockRejectedValueOnce(new Error("R2 timeout"));

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; warnings: unknown[] };
    expect(body.success).toBe(true);
    expect(body.warnings).toHaveLength(1);

    // Pending row must be inserted for the failed key
    expect(mocks.db.insert).toHaveBeenCalled();
    const insertedRows = mocks.state.insertCalls[0] as Array<{
      r2Key: string;
      attempts: number;
    }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].r2Key).toBe("users/user-1/resume.pdf");
    expect(insertedRows[0].attempts).toBe(1);

    // Account deletion batch must still proceed
    expect(mocks.db.batch).toHaveBeenCalled();
  });

  it("does not insert any pending row when all R2 deletes succeed", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [[{ r2Key: "users/user-1/resume.pdf" }]];
    // default r2Delete resolves successfully

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; warnings?: unknown[] };
    expect(body.success).toBe(true);
    expect(body.warnings).toBeUndefined();

    // No insert should have been called
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.batch).toHaveBeenCalled();
  });

  it("records multiple failed keys when more than one R2 delete fails", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [
      [
        { r2Key: "users/user-1/a.pdf" },
        { r2Key: "users/user-1/b.pdf" },
        { r2Key: "users/user-1/c.pdf" },
      ],
    ];
    mocks.r2Delete
      .mockRejectedValueOnce(new Error("fail a"))
      .mockResolvedValueOnce(undefined) // b succeeds
      .mockRejectedValueOnce(new Error("fail c"));

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { warnings: unknown[] };
    expect(body.warnings).toHaveLength(2);

    const insertedRows = mocks.state.insertCalls[0] as Array<{ r2Key: string }>;
    expect(insertedRows).toHaveLength(2);
    const keys = insertedRows.map((r) => r.r2Key).sort();
    expect(keys).toEqual(["users/user-1/a.pdf", "users/user-1/c.pdf"]);
  });
});
