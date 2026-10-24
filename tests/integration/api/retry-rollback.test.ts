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
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  log: vi.fn(),
  startResumeParse: vi.fn(),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: mocks.auth,
}));

vi.mock("@/lib/workflows/resume-parse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workflows/resume-parse")>()),
  startResumeParse: mocks.startResumeParse,
}));

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: {}, CLICKFOLIO_PARSE_WORKFLOW: {} },
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

function signedInWith(database: TestDb) {
  mocks.auth.mockResolvedValue({
    user: { id: "user_1" },
    dbUser: { id: "user_1", handle: null, clerkId: "clerk_1" },
    db: database,
    env: { CLICKFOLIO_PARSE_WORKFLOW: {} },
    error: null,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await testDb.reset();
  mocks.log.mockReset();
  mocks.startResumeParse.mockReset().mockRejectedValue(new Error("Workflow unavailable"));

  await db.insert(user).values({
    id: "user_1",
    name: "Avery",
    email: "avery@example.com",
    clerkId: "clerk_1",
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(resumes).values({
    id: "resume_1",
    userId: "user_1",
    r2Key: "users/user_1/resume_1/cv.pdf",
    fileHash: "hash_1",
    status: "failed",
    errorMessage: "PDF parsing error",
    createdAt: NOW,
  });
});

async function retry() {
  const { POST } = await import("@/app/api/resume/retry/route");

  return POST(
    new Request("https://clickfolio.me/api/resume/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_id: "resume_1" }),
    }),
  );
}

describe("POST /api/resume/retry when the workflow cannot start", () => {
  it("puts the row back to failed so it can be retried again", async () => {
    signedInWith(db);

    const response = await retry();

    expect(response.status).toBe(500);

    const [row] = await db.select().from(resumes).where(eq(resumes.id, "resume_1"));

    expect(row).toMatchObject({ status: "failed", retryCount: 0 });
  });

  it("answers 503 and logs the stranded row when the rollback itself fails", async () => {
    // update #1 queues the row, update #2 is the rollback.
    failUpdateNumber(2);
    signedInWith(db);

    const response = await retry();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });

    // Nothing recovers a queued row without a workflow run, so the log must say so.
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "Retry rollback failed; resume left queued without a workflow run",
      expect.objectContaining({ resumeId: "resume_1" }),
    );

    const [row] = await db.select().from(resumes).where(eq(resumes.id, "resume_1"));

    expect(row.status).toBe("queued");
  });
});
