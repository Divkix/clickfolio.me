import { eq } from "drizzle-orm";
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
import { resumes, user } from "@/lib/db/schema";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  deleteR2Objects: vi.fn(),
  bucket: { bound: true },
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.getDb() }));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuthForApi: async () => ({ user: { id: "admin-1", isAdmin: true }, error: null }),
}));

vi.mock("@/lib/workflows/r2-delete", () => ({
  deleteR2Objects: (...args: string[][]) => mocks.deleteR2Objects(...args),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: {},
    get CLICKFOLIO_R2_BUCKET() {
      return mocks.bucket.bound ? "bucket" : undefined;
    },
    CLICKFOLIO_R2_DELETE_WORKFLOW: {},
  },
}));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  mocks.getDb.mockReturnValue(db);
});

afterAll(async () => {
  await testDb.close();
});

const NOW = "2026-01-01T00:00:00.000Z";

async function insertUser(id: string, name: string, handle: string | null) {
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.com`,
    handle,
    clerkId: `clerk-${id}`,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function insertResume(id: string, userId: string, status: "failed" | "completed") {
  await db.insert(resumes).values({
    id,
    userId,
    r2Key: `key-${id}`,
    status,
    createdAt: NOW,
  });
}

beforeEach(async () => {
  await testDb.reset();
  mocks.deleteR2Objects.mockReset().mockResolvedValue([]);
  mocks.bucket.bound = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/users", () => {
  it("lists users with their pipeline status", async () => {
    await insertUser("u1", "Ada", "ada");
    await insertUser("u2", "Grace", null);
    await insertResume("r1", "u2", "failed");

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/users"));
    const body: { users: { id: string; status: string }[]; total: number } = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.users.find((u) => u.id === "u2")?.status).toBe("failed");
    expect(body.users.find((u) => u.id === "u1")?.status).toBe("no_resume");
  });

  it("treats LIKE wildcards in the search as literal characters", async () => {
    await insertUser("u1", "100% Real", "real");
    await insertUser("u2", "Someone Else", "else");

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/users?search=%25"));
    const body: { users: { id: string }[]; total: number } = await response.json();

    expect(body.total).toBe(1);
    expect(body.users.map((u) => u.id)).toEqual(["u1"]);
  });

  it("answers with the database error shape when Postgres is unreachable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.spyOn(db, "select").mockImplementation(() => {
      throw Object.assign(new Error("connection terminated"), { code: "08006" });
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/users"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });
    expect(logLines(error)[0]).toMatchObject({ failure: "DbFailed", kind: "unavailable" });
  });
});

describe("GET /api/admin/resumes", () => {
  it("counts every status and filters the list", async () => {
    await insertUser("u1", "Ada", "ada");
    await insertResume("r1", "u1", "failed");
    await insertResume("r2", "u1", "completed");

    const { GET } = await import("@/app/api/admin/resumes/route");

    const response = await GET(
      new Request("https://clickfolio.me/api/admin/resumes?status=failed"),
    );

    const body: { stats: Record<string, number>; resumes: { id: string }[]; total: number } =
      await response.json();

    expect(body.stats).toEqual({ completed: 1, processing: 0, queued: 0, failed: 1 });
    expect(body.resumes.map((r) => r.id)).toEqual(["r1"]);
    expect(body.total).toBe(1);
  });

  it("answers 400 for an unknown status filter", async () => {
    const { GET } = await import("@/app/api/admin/resumes/route");
    const response = await GET(new Request("https://clickfolio.me/api/admin/resumes?status=nope"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid status filter",
      code: "VALIDATION_ERROR",
    });
  });
});

describe("DELETE /api/admin/resumes/[id]", () => {
  async function dismiss(id: string) {
    const { DELETE } = await import("@/app/api/admin/resumes/[id]/route");

    return DELETE(
      new Request(`https://clickfolio.me/api/admin/resumes/${id}`, { method: "DELETE" }),
      {
        params: Promise.resolve({ id }),
      },
    );
  }

  beforeEach(async () => {
    await insertUser("u1", "Ada", "ada");
  });

  it("deletes a failed resume and hands its file to R2 cleanup", async () => {
    await insertResume("r1", "u1", "failed");

    const response = await dismiss("r1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "r1" });
    expect(await db.select().from(resumes).where(eq(resumes.id, "r1"))).toEqual([]);
    expect(mocks.deleteR2Objects.mock.calls[0][2]).toEqual(["key-r1"]);
  });

  it("keeps a resume that is not failed and answers 409", async () => {
    await insertResume("r1", "u1", "completed");

    const response = await dismiss("r1");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Only failed resumes can be dismissed",
      code: "CONFLICT",
    });
    expect(await db.select().from(resumes).where(eq(resumes.id, "r1"))).toHaveLength(1);
    expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown resume", async () => {
    const response = await dismiss("missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Resume not found", code: "NOT_FOUND" });
  });

  it("still answers 200 and logs when the R2 cleanup fails after the row is gone", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await insertResume("r1", "u1", "failed");
    mocks.deleteR2Objects.mockRejectedValue(new Error("r2 unavailable"));

    const response = await dismiss("r1");

    expect(response.status).toBe(200);
    expect(await db.select().from(resumes).where(eq(resumes.id, "r1"))).toEqual([]);

    const logged = logLines(error);

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      msg: "admin resume dismiss: R2 cleanup failed",
      operation: "admin.resume.r2-delete",
      kind: "unavailable",
    });
    expect(JSON.stringify(logged)).not.toContain("key-r1");
  });

  it("skips the cleanup when no bucket is bound", async () => {
    await insertResume("r1", "u1", "failed");
    mocks.bucket.bound = false;

    const response = await dismiss("r1");

    expect(response.status).toBe(200);
    expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
  });
});
