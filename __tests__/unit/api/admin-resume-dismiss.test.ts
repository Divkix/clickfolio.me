import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

const mocks = vi.hoisted(() => {
  const state = {
    deleteResult: [] as JsonValue[],
    selectResult: [] as JsonValue[],
    insertCalls: [] as JsonValue[],
  };

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => state.selectResult),
    };
    return chain;
  };

  const createDeleteChain = () => {
    const chain = {
      where: vi.fn(() => chain),
      returning: vi.fn(async () => state.deleteResult),
    };
    return chain;
  };

  const createInsertChain = () => {
    const chain = {
      values: vi.fn((rows: JsonValue) => {
        state.insertCalls.push(rows);
        return chain;
      }),
      onConflictDoNothing: vi.fn(async () => undefined),
    };
    return chain;
  };

  const db = {
    select: vi.fn(() => createSelectChain()),
    delete: vi.fn(() => createDeleteChain()),
    insert: vi.fn(() => createInsertChain()),
  };

  const r2Delete = vi.fn(async () => undefined);
  const bucket = { list: vi.fn(async () => ({ objects: [] })) };
  const env = { CLICKFOLIO_R2_BUCKET: bucket };

  return { state, db, env, bucket, r2Delete };
});

vi.mock("cloudflare:workers", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mocks.db),
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuthForApi: vi.fn(async () => ({
    user: { id: "admin_1", email: "admin@example.com", name: "Admin", isAdmin: true },
    error: null,
  })),
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn((env: typeof mocks.env) => env.CLICKFOLIO_R2_BUCKET),
  R2: {
    delete: mocks.r2Delete,
  },
}));

vi.mock("drizzle-orm", () => ({
  relations: vi.fn((_table, build) =>
    build({
      many: vi.fn((table) => ({ relation: "many", table })),
      one: vi.fn((table, config) => ({ relation: "one", table, config })),
    }),
  ),
  eq: vi.fn((field, value) => ({ op: "eq", field, value })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
}));

async function dismiss(id = "resume-1") {
  const { DELETE } = await import("@/app/api/admin/resumes/[id]/route");
  return DELETE(
    new Request(`https://clickfolio.me/api/admin/resumes/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
}

describe("DELETE /api/admin/resumes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.deleteResult = [];
    mocks.state.selectResult = [];
    mocks.state.insertCalls = [];
    mocks.r2Delete.mockResolvedValue(undefined);
  });

  it("deletes the row before its R2 object and reports success", async () => {
    mocks.state.deleteResult = [{ id: "resume-1", r2Key: "users/user-1/resume-1/cv.pdf" }];

    const response = await dismiss();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "resume-1" });
    expect(mocks.r2Delete).toHaveBeenCalledWith(mocks.bucket, "users/user-1/resume-1/cv.pdf");
    expect(mocks.db.delete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.r2Delete.mock.invocationCallOrder[0],
    );
  });

  it("returns 409 without touching R2 when the row was revived", async () => {
    mocks.state.deleteResult = [];
    mocks.state.selectResult = [{ id: "resume-1" }];

    const response = await dismiss();

    expect(response.status).toBe(409);
    expect(mocks.r2Delete).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("returns 404 when the resume does not exist", async () => {
    mocks.state.deleteResult = [];
    mocks.state.selectResult = [];

    const response = await dismiss();

    expect(response.status).toBe(404);
    expect(mocks.r2Delete).not.toHaveBeenCalled();
  });

  it("enqueues a pending deletion when the R2 delete fails after the row is gone", async () => {
    mocks.state.deleteResult = [{ id: "resume-1", r2Key: "users/user-1/resume-1/cv.pdf" }];
    mocks.r2Delete.mockRejectedValueOnce(new Error("R2 unavailable"));

    const response = await dismiss();

    expect(response.status).toBe(200);
    const insertedRow = mocks.state.insertCalls[0] as { r2Key: string; attempts: number };
    expect(insertedRow.r2Key).toBe("users/user-1/resume-1/cv.pdf");
    expect(insertedRow.attempts).toBe(1);
  });
});
