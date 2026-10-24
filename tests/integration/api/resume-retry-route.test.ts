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
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import type { JsonValue } from "@/lib/types/json";
import { sha256Hex } from "@/lib/utils/hash";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  log: vi.fn(),
  startResumeParse: vi.fn(),
  bucketGet: vi.fn(),
  bound: { workflow: true },
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    get CLICKFOLIO_PARSE_WORKFLOW() {
      if (!mocks.bound.workflow) return undefined;

      // The real WorkflowStarter calls this binding; `mocks.startResumeParse` records the start.
      const workflow = {
        create: async ({ id, params }: { id: string; params: unknown }) => {
          await mocks.startResumeParse(workflow, id, params);

          return { id };
        },
        get: async () => {
          throw new Error("instance.not_found");
        },
      };

      return workflow;
    },
    CLICKFOLIO_R2_BUCKET: { get: mocks.bucketGet },
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db() }));

vi.mock("@/lib/auth/clerk", async (importOriginal) => {
  const { authenticateStub } = await import("@/tests/helpers/authenticate-stub");
  const { DEFAULT_PRIVACY_SETTINGS: privacySettings } = await import("@/lib/utils/privacy");

  return {
    ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
    authenticate: authenticateStub(async () => ({
      error: null,
      user: {
        id: "user_1",
        email: "avery@example.com",
        name: "Avery",
        image: null,
        handle: "avery",
        headline: null,
        privacySettings,
        onboardingCompleted: true,
        role: "mid_level",
      },
      dbUser: { id: "user_1", handle: "avery", clerkId: "clerk_1" },
    })),
  };
});

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

/** Makes the nth `update` statement on `db` fail, like a connection that drops mid-request. */
function failUpdateNumber(failOn: number) {
  const update = db.update.bind(db);
  let updates = 0;

  vi.spyOn(db, "update").mockImplementation((...args: Parameters<TestDb["update"]>) => {
    updates += 1;

    if (updates === failOn) {
      throw Object.assign(new Error("connection terminated unexpectedly"), { code: "08006" });
    }

    return update(...args);
  });
}

async function insertResume(overrides: Partial<typeof resumes.$inferInsert> = {}) {
  await db.insert(resumes).values({
    id: "resume_1",
    userId: "user_1",
    r2Key: "users/user_1/resume_1/cv.pdf",
    fileHash: "hash_1",
    status: "failed",
    errorMessage: "PDF parsing error",
    createdAt: NOW,
    ...overrides,
  });
}

async function readRow() {
  const [row] = await db.select().from(resumes).where(eq(resumes.id, "resume_1"));

  return row;
}

async function retry(body: JsonValue = { resume_id: "resume_1" }) {
  const { POST } = await import("@/app/api/resume/retry/route");

  return POST(
    new Request("https://clickfolio.me/api/resume/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  await testDb.reset();
  mocks.db.mockReset().mockImplementation(() => db);
  mocks.log.mockReset();
  mocks.bound.workflow = true;
  mocks.startResumeParse.mockReset().mockResolvedValue(undefined);
  mocks.bucketGet.mockReset();

  await db.insert(user).values([
    {
      id: "user_1",
      name: "Avery",
      email: "avery@example.com",
      clerkId: "clerk_1",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "user_2",
      name: "Blake",
      email: "blake@example.com",
      clerkId: "clerk_2",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/resume/retry", () => {
  it("queues the failed resume and starts a run under a per-retry instance id", async () => {
    await insertResume();

    const response = await retry();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "queued", retry_count: 1 });
    expect(await readRow()).toMatchObject({ status: "queued", retryCount: 1, errorMessage: null });

    expect(mocks.startResumeParse).toHaveBeenCalledTimes(1);
    expect(mocks.startResumeParse).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("resume_1"),
      expect.objectContaining({
        kind: "parse",
        resumeId: "resume_1",
        userId: "user_1",
        fileHash: "hash_1",
      }),
    );
  });

  it("answers 400 without a resume_id and 404 for an unknown resume", async () => {
    expect((await retry({})).status).toBe(400);
    expect((await retry(null)).status).toBe(400);
    expect((await retry({ resume_id: "missing" })).status).toBe(404);
  });

  it("answers 403 for another user's resume and leaves it alone", async () => {
    await insertResume({ userId: "user_2", r2Key: "users/user_2/resume_1/cv.pdf" });

    const response = await retry();

    expect(response.status).toBe(403);
    expect(await readRow()).toMatchObject({ status: "failed", retryCount: 0 });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
  });

  it("refuses a resume that is not failed", async () => {
    await insertResume({ status: "completed" });

    const response = await retry();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
  });

  it("hashes the stored file when the row has no recorded hash", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 stored resume");

    mocks.bucketGet.mockResolvedValue({ arrayBuffer: async () => bytes.buffer });
    await insertResume({ fileHash: null });

    const response = await retry();

    expect(response.status).toBe(200);
    expect(mocks.startResumeParse).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ fileHash: await sha256Hex(bytes) }),
    );
  });

  it("answers 500 and leaves the row failed when the stored file is gone", async () => {
    mocks.bucketGet.mockResolvedValue(null);
    await insertResume({ fileHash: null });

    const response = await retry();

    expect(response.status).toBe(500);
    expect(await readRow()).toMatchObject({ status: "failed", retryCount: 0 });
  });

  it("answers 503 and leaves the row failed when R2 cannot be read", async () => {
    mocks.bucketGet.mockRejectedValue(new Error("R2 is down"));
    await insertResume({ fileHash: null });

    const response = await retry();

    expect(response.status).toBe(503);
    expect(await readRow()).toMatchObject({ status: "failed", retryCount: 0 });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume/retry when the workflow cannot start", () => {
  it("puts the row back to failed so it can be retried again", async () => {
    mocks.startResumeParse.mockRejectedValue(new Error("Workflow unavailable"));
    await insertResume();

    const response = await retry();

    expect(response.status).toBe(503);
    expect(await readRow()).toMatchObject({
      status: "failed",
      retryCount: 0,
      errorMessage: "PDF parsing error",
      queuedAt: null,
    });
  });

  it("answers 503 and rolls back when the Workflow binding is missing", async () => {
    mocks.bound.workflow = false;
    await insertResume();

    const response = await retry();

    expect(response.status).toBe(503);
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
    expect(await readRow()).toMatchObject({ status: "failed", retryCount: 0 });
  });

  it("gives up with 504 after the Workflow timeout, rolls back and never starts twice", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.startResumeParse.mockReturnValue(new Promise(() => {}));
    await insertResume();

    const pending = retry();

    await vi.waitFor(() => expect(mocks.startResumeParse).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.workflow + 1);

    const response = await pending;

    expect(response.status).toBe(504);
    expect(mocks.startResumeParse).toHaveBeenCalledTimes(1);
    expect(await readRow()).toMatchObject({ status: "failed", retryCount: 0 });
  });

  it("answers 503 and logs the stranded row when the rollback itself fails", async () => {
    mocks.startResumeParse.mockRejectedValue(new Error("Workflow unavailable"));
    // update #1 queues the row, update #2 is the rollback.
    failUpdateNumber(2);
    await insertResume();

    const response = await retry();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });

    // Nothing recovers a queued row without a workflow run, so the log must say so.
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "Retry rollback failed; resume left queued without a workflow run",
      expect.objectContaining({ resumeId: "resume_1" }),
    );

    expect((await readRow()).status).toBe("queued");
  });
});
