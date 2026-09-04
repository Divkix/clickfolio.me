import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UnknownRecord, JsonValue } from "@/lib/types/json";

const mocks = vi.hoisted(() => {
  type MockAuthResult = {
    user: { id: string; email: string };
    dbUser: { id: string; handle: string; clerkId: string };
    db: JsonValue;
    env: JsonValue;
    error: JsonValue;
  } | null;
  const state = {
    selectResults: [] as JsonValue[][],
    authResult: null as MockAuthResult,
    insertCalls: [] as JsonValue[],
  };

  const nextSelectResult = (): JsonValue[] => {
    if (state.selectResults.length === 0) {
      throw new Error("No select result queued");
    }
    return state.selectResults.shift() as JsonValue[];
  };

  const insertChain = {
    values: vi.fn((rows: JsonValue) => {
      state.insertCalls.push(rows);
      return Promise.resolve(undefined);
    }),
  };

  const deleteWhere = vi.fn(async () => undefined);
  const clerkDeleteUser = vi.fn(async () => undefined);

  const createChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      values: vi.fn(() => chain),
      set: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
      returning: vi.fn(() => chain),
      then: vi.fn(
        (resolve: (value: JsonValue[]) => JsonValue, reject?: (reason: JsonValue) => JsonValue) => {
          try {
            return Promise.resolve(resolve(nextSelectResult()));
          } catch (error) {
            return reject
              ? Promise.reject(reject(error as JsonValue))
              : Promise.reject(error as JsonValue);
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
    delete: vi.fn(() => ({ where: deleteWhere })),
  };

  const env = {
    CLICKFOLIO_R2_BUCKET: { list: vi.fn(async () => ({ objects: [] })) },
    CLICKFOLIO_PARSE_QUEUE: { send: vi.fn(async () => undefined) },
    CLERK_SECRET_KEY: "sk_test_account_delete",
    CF_AI_GATEWAY_ACCOUNT_ID: "acct",
    CF_AI_GATEWAY_ID: "gateway",
    CF_AIG_AUTH_TOKEN: "token",
  };

  const r2Delete = vi.fn(async () => undefined);

  return { state, db, env, insertChain, deleteWhere, clerkDeleteUser, r2Delete };
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

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(() => ({ users: { deleteUser: mocks.clerkDeleteUser } })),
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

function jsonRequest(path: string, body: JsonValue) {
  return new Request(`https://clickfolio.me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authed(overrides: UnknownRecord = {}) {
  mocks.state.authResult = {
    user: { id: "user_1", email: "avery@example.com" },
    dbUser: { id: "user_1", handle: "avery", clerkId: "user_clerk_1" },
    db: mocks.db as unknown as JsonValue,
    env: mocks.env as unknown as JsonValue,
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
    mocks.deleteWhere.mockResolvedValue(undefined);
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
    const body = (await response.json()) as { success: boolean; warnings: JsonValue[] };
    expect(body.success).toBe(true);
    expect(body.warnings).toHaveLength(1);

    expect(mocks.db.insert).toHaveBeenCalled();
    const insertedRows = mocks.state.insertCalls[0] as Array<{
      r2Key: string;
      attempts: number;
    }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].r2Key).toBe("users/user-1/resume.pdf");
    expect(insertedRows[0].attempts).toBe(1);

    expect(mocks.clerkDeleteUser).toHaveBeenCalledWith("user_clerk_1");
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
    expect(mocks.db.insert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clerkDeleteUser.mock.invocationCallOrder[0],
    );
  });

  it("does not insert any pending row when all R2 deletes succeed", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [[{ r2Key: "users/user-1/resume.pdf" }]];

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; warnings?: JsonValue[] };
    expect(body.success).toBe(true);
    expect(body.warnings).toBeUndefined();

    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.clerkDeleteUser).toHaveBeenCalledWith("user_clerk_1");
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
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
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("fail c"));

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { warnings: JsonValue[] };
    expect(body.warnings).toHaveLength(2);

    const insertedRows = mocks.state.insertCalls[0] as Array<{ r2Key: string }>;
    expect(insertedRows).toHaveLength(2);
    const keys = insertedRows.map((r) => r.r2Key).sort();
    expect(keys).toEqual(["users/user-1/a.pdf", "users/user-1/c.pdf"]);
  });

  it("returns 503 when Clerk identity deletion fails with a non-404 error", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [[{ r2Key: "users/user-1/resume.pdf" }]];
    mocks.r2Delete.mockRejectedValueOnce(new Error("R2 timeout"));
    mocks.clerkDeleteUser.mockRejectedValueOnce(
      Object.assign(new Error("clerk unavailable"), { status: 500 }),
    );

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(503);
    const insertedRows = mocks.state.insertCalls[0] as Array<{ r2Key: string }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].r2Key).toBe("users/user-1/resume.pdf");
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });

  it("tolerates a 404 from Clerk (identity already deleted) and finishes locally", async () => {
    const { POST } = await import("@/app/api/account/delete/route");

    authed();
    mocks.state.selectResults = [[{ r2Key: null }]];
    mocks.clerkDeleteUser.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { status: 404 }),
    );

    const response = await POST(
      jsonRequest("/api/account/delete", { confirmation: "avery@example.com" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.clerkDeleteUser).toHaveBeenCalledWith("user_clerk_1");
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });
});
