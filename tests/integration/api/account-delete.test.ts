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
import { handleChanges, resumes, siteData, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { NOW, seedUser, signedInAs } from "../../helpers/clerk-session";
import { logLines } from "../../helpers/log-lines";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

type FakeBucket = {
  objects: Set<string>;
  deleted: string[];
  failDeletes: boolean;
  failList: boolean;
};

type Bindings = { bucketBound: boolean; secretKey: string | undefined; workflowBound: boolean };

const mocks = vi.hoisted(() => {
  const state: Bindings = {
    bucketBound: true,
    secretKey: "sk_test_clickfolio_secret",
    workflowBound: true,
  };

  return {
    getDb: vi.fn(),
    deleteUser: vi.fn(),
    revalidate: vi.fn(),
    indexNow: vi.fn(),
    workflowCreate: vi.fn(),
    state,
  };
});

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: { deleteUser: mocks.deleteUser } })),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const bucket: FakeBucket = { objects: new Set(), deleted: [], failDeletes: false, failList: false };

vi.mock("cloudflare:workers", () => ({
  env: {
    get CLERK_SECRET_KEY() {
      return mocks.state.secretKey;
    },
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    get CLICKFOLIO_R2_BUCKET() {
      return mocks.state.bucketBound ? fakeBucket() : undefined;
    },
    get CLICKFOLIO_R2_DELETE_WORKFLOW() {
      return mocks.state.workflowBound ? { create: mocks.workflowCreate } : undefined;
    },
  },
  waitUntil: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.getDb() }));

vi.mock("@/lib/utils/revalidate", () => ({
  revalidatePublicProfilePages: (handles: unknown[]) => mocks.revalidate(handles),
}));

vi.mock("@/lib/seo/indexnow-runtime", () => ({
  notifyIndexNowForProfiles: (handles: unknown[], options?: { skipDebounce?: boolean }) =>
    mocks.indexNow(handles, options),
}));

function fakeBucket() {
  return {
    async list(options: { prefix: string }) {
      if (bucket.failList) throw new Error("r2 list down");

      const objects = [...bucket.objects].flatMap((key) =>
        key.startsWith(options.prefix) ? [{ key }] : [],
      );

      return { objects, truncated: false };
    },
    async delete(keys: string | string[]) {
      if (bucket.failDeletes) throw new Error("r2 delete down");

      for (const key of [keys].flat()) {
        bucket.deleted.push(key);
        bucket.objects.delete(key);
      }
    },
  };
}

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

beforeEach(async () => {
  await testDb.reset();
  await seedUser(db, "alice");
  await seedUser(db, "bob");
  signedInAs("clerk-alice");
  mocks.deleteUser.mockReset().mockResolvedValue({});
  mocks.workflowCreate.mockReset().mockResolvedValue({ id: "wf-1" });
  mocks.state.bucketBound = true;
  mocks.state.secretKey = "sk_test_clickfolio_secret";
  mocks.state.workflowBound = true;
  bucket.objects = new Set();
  bucket.deleted = [];
  bucket.failDeletes = false;
  bucket.failList = false;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.revalidate.mockClear();
  mocks.indexNow.mockClear();
});

function deletion(body: JsonValue = { confirmation: "alice@example.com" }): Request {
  return new Request("https://clickfolio.me/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedAliceFiles() {
  await db.insert(resumes).values({
    id: "r-alice",
    userId: "alice",
    r2Key: "users/alice/r-alice/cv.pdf",
    status: "completed",
    createdAt: NOW,
  });

  await db.insert(siteData).values({
    id: "sd-alice",
    userId: "alice",
    content: INDEXABLE_CONTENT,
    contentIndexable: true,
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(handleChanges).values({
    id: "hc-alice",
    userId: "alice",
    oldHandle: null,
    newHandle: "handle-alice",
    createdAt: NOW,
  });

  bucket.objects.add("users/alice/r-alice/cv.pdf");
  bucket.objects.add("users/alice/1700000000/orphan.pdf");
  bucket.objects.add("users/bob/r-bob/cv.pdf");
}

async function userRows(id: string) {
  return db.select({ id: user.id }).from(user).where(eq(user.id, id));
}

describe("POST /api/account/delete", () => {
  it("deletes the Clerk identity before the local rows", async () => {
    await seedAliceFiles();

    let aliceExistedWhenClerkRan = false;

    mocks.deleteUser.mockImplementation(async () => {
      aliceExistedWhenClerkRan = (await userRows("alice")).length === 1;

      return {};
    });

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledWith("clerk-alice");
    expect(aliceExistedWhenClerkRan).toBe(true);
    expect(await userRows("alice")).toHaveLength(0);
  });

  it("removes every row of the user and every R2 object under their prefix, and only theirs", async () => {
    await seedAliceFiles();

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());
    const body: { warnings?: unknown } = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: "Your account has been permanently deleted",
    });
    expect(body.warnings).toBeUndefined();
    expect(await db.select().from(resumes)).toHaveLength(0);
    expect(await db.select().from(siteData)).toHaveLength(0);
    expect(await userRows("bob")).toHaveLength(1);
    expect([...bucket.deleted].sort()).toEqual([
      "users/alice/1700000000/orphan.pdf",
      "users/alice/r-alice/cv.pdf",
    ]);
    expect(bucket.objects.has("users/bob/r-bob/cv.pdf")).toBe(true);
    expect(mocks.workflowCreate).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith(["handle-alice"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["handle-alice"], { skipDebounce: true });
  });

  it("keeps the local account and its files when Clerk deletion fails, so a retry works", async () => {
    await seedAliceFiles();
    mocks.deleteUser.mockRejectedValue(Object.assign(new Error("clerk down"), { status: 503 }));

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await userRows("alice")).toHaveLength(1);
    expect(bucket.deleted).toEqual([]);
    expect(mocks.workflowCreate).not.toHaveBeenCalled();
  });

  it("carries on when Clerk no longer has the user (404)", async () => {
    await seedAliceFiles();
    mocks.deleteUser.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(200);
    expect(await userRows("alice")).toHaveLength(0);
  });

  it("refuses a confirmation that is not the account email, before touching Clerk", async () => {
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion({ confirmation: "bob@example.com" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Email confirmation does not match your account email",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("accepts the confirmation in any letter case", async () => {
    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion({ confirmation: "Alice@Example.com" }));

    expect(response.status).toBe(200);
  });

  it.each([{}, { confirmation: "not-an-email" }])(
    "answers 400 for the invalid body %j",
    async (body) => {
      const { POST } = await import("@/app/api/account/delete/route");
      const response = await POST(deletion(body));

      expect(response.status).toBe(400);
      expect(mocks.deleteUser).not.toHaveBeenCalled();
    },
  );

  it("answers 500 without deleting anything when storage is not bound", async () => {
    mocks.state.bucketBound = false;

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(await userRows("alice")).toHaveLength(1);
  });

  it("answers 5xx without deleting anything when the Clerk secret is not configured", async () => {
    mocks.state.secretKey = undefined;

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    // Sign-in verification already needs the key, so the request stops before the route runs.
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(await userRows("alice")).toHaveLength(1);
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("hands R2 deletion to the workflow when inline deletes fail, and still answers 200", async () => {
    await seedAliceFiles();
    bucket.failDeletes = true;

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(200);
    expect(await userRows("alice")).toHaveLength(0);
    expect(mocks.workflowCreate).toHaveBeenCalledTimes(1);

    const [{ params }] = mocks.workflowCreate.mock.calls[0];

    expect(params.keys).toContain("users/alice/r-alice/cv.pdf");
  });

  it("reports files that could not be deleted yet by count, never by key", async () => {
    await seedAliceFiles();
    bucket.failDeletes = true;

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());
    const text = await response.text();

    expect(response.status).toBe(200);
    // Keys end in the uploaded file name: they must not leave the server.
    expect(text).not.toContain("users/alice");
    expect(text).not.toContain("cv.pdf");
    expect(JSON.parse(text)).toMatchObject({
      warnings: [
        { type: "r2", message: "2 stored files could not be deleted yet and will be retried." },
      ],
    });
  });

  it("does not answer success when the local data could not be removed after Clerk was deleted", async () => {
    await seedAliceFiles();
    vi.spyOn(db, "transaction").mockRejectedValueOnce(
      Object.assign(new Error("connection terminated"), { code: "08006" }),
    );

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());
    const body: { success?: boolean; error?: string } = await response.json();

    expect(mocks.deleteUser).toHaveBeenCalledWith("clerk-alice");
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(body.success).toBeUndefined();
    expect(body.error).toContain("sign-in was deleted");
    expect(body.error).toContain("completed automatically");
    expect(await userRows("alice")).toHaveLength(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(logLines(vi.mocked(console.log)).map((line) => line.event)).not.toContain(
      "account_deleted",
    );
  });

  it("hands the whole prefix to the workflow when the local delete fails, so files do not linger", async () => {
    await seedAliceFiles();
    vi.spyOn(db, "transaction").mockRejectedValueOnce(
      Object.assign(new Error("connection terminated"), { code: "08006" }),
    );

    const { POST } = await import("@/app/api/account/delete/route");

    await POST(deletion());

    expect(mocks.workflowCreate).toHaveBeenCalledWith({
      params: { keys: [], prefix: "users/alice/" },
    });
  });

  it("still answers 200 when the user.deleted webhook removed the rows first", async () => {
    await seedAliceFiles();

    const realTransaction = db.transaction.bind(db);

    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await db.delete(user).where(eq(user.id, "alice"));

      return realTransaction(run, config);
    });

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(200);
    expect(bucket.deleted).toContain("users/alice/1700000000/orphan.pdf");
  });

  it("sweeps the prefix in the workflow when listing the bucket fails", async () => {
    await seedAliceFiles();
    bucket.failList = true;

    const { POST } = await import("@/app/api/account/delete/route");
    const response = await POST(deletion());

    expect(response.status).toBe(200);
    expect(mocks.workflowCreate).toHaveBeenCalledWith({
      params: expect.objectContaining({ prefix: "users/alice/" }),
    });
    expect(bucket.deleted).toContain("users/alice/r-alice/cv.pdf");
  });
});
