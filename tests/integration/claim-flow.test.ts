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
import { resumes, siteData, user } from "@/lib/db/schema";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import type { JsonValue } from "@/lib/types/json";
import { sha256Hex } from "@/lib/utils/hash";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "@/tests/helpers/pglite-db";
import { logLines } from "@/tests/helpers/log-lines";

const TEST_SECRET = "test-secret-key-for-testing-only";
const TEMP_KEY = "temp/uuid/resume.pdf";
const NOW = "2026-01-01T00:00:00.000Z";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  startResumeParse: vi.fn(),
  revalidate: vi.fn(),
  indexNow: vi.fn(),
  bound: { workflow: true },
  auth: { signedIn: true },
  bucket: {
    objects: new Map<string, Uint8Array>(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    PENDING_UPLOAD_SECRET: "test-secret-key-for-testing-only",
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
    CLICKFOLIO_R2_BUCKET: mocks.bucket,
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db() }));

vi.mock("@/lib/utils/revalidate", () => ({
  revalidatePublicProfilePages: (handles: unknown[]) => mocks.revalidate(handles),
}));

vi.mock("@/lib/seo/indexnow-runtime", () => ({
  notifyIndexNowForProfiles: (handles: unknown[]) => mocks.indexNow(handles),
}));

vi.mock("@/lib/auth/clerk", async (importOriginal) => {
  const { authenticateStub } = await import("@/tests/helpers/authenticate-stub");
  const { DEFAULT_PRIVACY_SETTINGS: privacySettings } = await import("@/lib/utils/privacy");

  return {
    ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
    authenticate: authenticateStub(async () => {
      if (!mocks.auth.signedIn) return { error: new Response(null, { status: 401 }) };

      return {
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
      };
    }),
  };
});

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;
let pdfHash: string;

const pdfBytes = new TextEncoder().encode("%PDF-1.4 fake content");

async function createSignedCookieValue(
  tempKey: string,
  secret: string,
  expiresAt?: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const actualExpiresAt = expiresAt ?? Date.now() + 30 * 60 * 1000;
  const payload = `${tempKey}|${actualExpiresAt}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${payload}|${signatureBase64}`;
}

async function claim(
  body: JsonValue = { key: TEMP_KEY },
  options: { cookie?: string | null; headers?: Record<string, string> } = {},
) {
  const cookie =
    options.cookie === undefined
      ? await createSignedCookieValue(TEMP_KEY, TEST_SECRET)
      : options.cookie;

  const headers = new Headers({ "Content-Type": "application/json", ...options.headers });

  if (cookie) headers.set("Cookie", `pending_upload=${cookie}`);

  const { POST } = await import("@/app/api/resume/claim/route");

  return POST(
    new Request("http://localhost:3000/api/resume/claim", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

function connectionLost(): Error {
  return Object.assign(new Error("connection terminated unexpectedly"), { code: "08006" });
}

/** Makes the nth `update` statement on `db` fail, like a connection that drops mid-request. */
function failUpdateNumber(failOn: number) {
  const update = db.update.bind(db);
  let updates = 0;

  vi.spyOn(db, "update").mockImplementation((...args: Parameters<TestDb["update"]>) => {
    updates += 1;

    if (updates === failOn) throw connectionLost();

    return update(...args);
  });
}

async function insertUsers(handle: string | null = "avery") {
  await db.insert(user).values([
    {
      id: "user_1",
      name: "Avery",
      email: "avery@example.com",
      handle,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
}

async function insertResume(overrides: Partial<typeof resumes.$inferInsert> = {}) {
  await db.insert(resumes).values({
    id: "existing_1",
    userId: "user_1",
    r2Key: "users/user_1/existing_1/resume.pdf",
    fileHash: "other_hash",
    status: "completed",
    createdAt: NOW,
    ...overrides,
  });
}

async function readClaimed() {
  const rows = await db.select().from(resumes).where(eq(resumes.userId, "user_1"));

  return rows.filter((row) => row.id !== "existing_1");
}

/** Records the r2Key the claim row names at the moment the temp object is deleted. */
function rowKeyAtTempDelete() {
  const recorded = vi.fn();

  mocks.bucket.delete.mockImplementation(async (key: string | string[]) => {
    for (const one of Array.isArray(key) ? key : [key]) mocks.bucket.objects.delete(one);

    const [row] = await readClaimed();

    recorded(row?.r2Key);
  });

  return recorded;
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  pdfHash = await sha256Hex(pdfBytes.slice());
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  mocks.db.mockReset().mockImplementation(() => db);
  mocks.bound.workflow = true;
  mocks.startResumeParse.mockReset().mockResolvedValue(undefined);
  mocks.revalidate.mockReset();
  mocks.indexNow.mockReset();
  mocks.bucket.objects.clear();
  mocks.bucket.objects.set(TEMP_KEY, pdfBytes);
  mocks.bucket.get.mockReset().mockImplementation(async (key: string) => {
    const bytes = mocks.bucket.objects.get(key);

    return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null;
  });
  mocks.bucket.put.mockReset().mockImplementation(async (key: string, body: Uint8Array) => {
    mocks.bucket.objects.set(key, body);

    return { size: body.byteLength, etag: "etag" };
  });
  mocks.bucket.delete.mockReset().mockImplementation(async (key: string | string[]) => {
    for (const one of Array.isArray(key) ? key : [key]) mocks.bucket.objects.delete(one);
  });
  mocks.auth.signedIn = true;
  await insertUsers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/resume/claim", () => {
  it("answers 401 for a signed-out visitor", async () => {
    mocks.auth.signedIn = false;

    expect((await claim()).status).toBe(401);
  });

  it("answers 400 when the key is missing", async () => {
    const response = await claim({});

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Invalid upload key"),
    });
  });

  it("answers 400 when the key is not a temporary upload", async () => {
    const cookie = await createSignedCookieValue("users/hack/resume.pdf", TEST_SECRET);
    const response = await claim({ key: "users/hack/resume.pdf" }, { cookie });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("temporary upload"),
    });
  });

  it("answers 413 when the request is too large", async () => {
    const response = await claim({ key: TEMP_KEY }, { headers: { "Content-Length": "9000000" } });

    expect(response.status).toBe(413);
  });

  it("answers 404 when the file is gone and no claim of it exists", async () => {
    mocks.bucket.objects.clear();

    const response = await claim();

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("not found") });
  });

  it("answers already_claimed when the file is gone but a claim of it exists", async () => {
    mocks.bucket.objects.clear();
    await insertResume({ id: "claimed_1", r2Key: TEMP_KEY, status: "processing" });

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      already_claimed: true,
      resume_id: "claimed_1",
      status: "processing",
    });
  });

  it("answers 503 on a transient R2 read failure even if a claim exists", async () => {
    mocks.bucket.get.mockRejectedValue(new Error("R2 timeout"));
    await insertResume({ id: "claimed_1", r2Key: TEMP_KEY, status: "processing" });

    const response = await claim();

    expect(response.status).toBe(503);
  });

  it("answers 400 for a file that is not a PDF", async () => {
    mocks.bucket.objects.set(TEMP_KEY, new TextEncoder().encode("<html>not a pdf</html>"));

    const response = await claim();

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid PDF format" });
    expect(await readClaimed()).toHaveLength(0);
  });

  it("queues a new resume: moves the file, stores the row and starts the parse", async () => {
    const response = await claim();

    expect(response.status).toBe(200);

    const body: { resume_id: string; status: string } = await response.json();

    expect(body.status).toBe("queued");

    const [row] = await readClaimed();

    expect(row).toMatchObject({
      id: body.resume_id,
      status: "queued",
      fileHash: pdfHash,
      r2Key: `users/user_1/${body.resume_id}/resume.pdf`,
    });
    expect(mocks.bucket.objects.has(row.r2Key)).toBe(true);
    expect(mocks.bucket.objects.has(TEMP_KEY)).toBe(false);

    expect(mocks.startResumeParse).toHaveBeenCalledTimes(1);
    expect(mocks.startResumeParse).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(body.resume_id),
      expect.objectContaining({
        kind: "parse",
        resumeId: body.resume_id,
        userId: "user_1",
        r2Key: row.r2Key,
        fileHash: pdfHash,
        retryCount: 0,
      }),
    );
  });

  it("deletes the temp object only after the row is queued", async () => {
    const atDelete = rowKeyAtTempDelete();

    const response = await claim();

    expect(response.status).toBe(200);

    const [row] = await readClaimed();

    expect(atDelete).toHaveBeenCalledTimes(1);
    expect(atDelete).toHaveBeenCalledWith(row?.r2Key);
    expect(atDelete).toHaveBeenCalledWith(`users/user_1/${row?.id}/resume.pdf`);
    expect(mocks.bucket.objects.has(TEMP_KEY)).toBe(false);
  });

  it("accepts a percent-encoded signed cookie", async () => {
    const cookie = encodeURIComponent(await createSignedCookieValue(TEMP_KEY, TEST_SECRET));

    expect((await claim({ key: TEMP_KEY }, { cookie })).status).toBe(200);
  });

  it("answers already_claimed for a duplicate pending claim of the same file", async () => {
    await insertResume({
      id: "pending_1",
      r2Key: "temp/other/resume.pdf",
      fileHash: pdfHash,
      status: "pending_claim",
    });

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      already_claimed: true,
      resume_id: "pending_1",
      status: "pending_claim",
    });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
    expect(await readClaimed()).toHaveLength(1);
  });
});

describe("POST /api/resume/claim: dedup against the same file", () => {
  it("completes inline from an earlier identical parse and publishes it", async () => {
    await insertResume({
      fileHash: pdfHash,
      status: "completed",
      parsedContent: INDEXABLE_CONTENT,
    });

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "completed", cached: true });

    const [row] = await readClaimed();

    expect(row).toMatchObject({ status: "completed", parsedContent: INDEXABLE_CONTENT });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();

    const [site] = await db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(site?.resumeId).toBe(row.id);
    expect(site?.lastPublishedAt).not.toBeNull();
    expect(mocks.revalidate).toHaveBeenCalledWith(["avery"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["avery"]);
  });

  it("deletes the temp object only after the cached row names the new key", async () => {
    await insertResume({
      fileHash: pdfHash,
      status: "completed",
      parsedContent: INDEXABLE_CONTENT,
    });
    const atDelete = rowKeyAtTempDelete();

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "completed", cached: true });

    const [row] = await readClaimed();

    expect(atDelete).toHaveBeenCalledTimes(1);
    expect(atDelete).toHaveBeenCalledWith(row?.r2Key);
    expect(atDelete).toHaveBeenCalledWith(`users/user_1/${row?.id}/resume.pdf`);
    expect(mocks.bucket.objects.has(TEMP_KEY)).toBe(false);
  });

  it("refreshes the page but pings no search engine for a profile hidden from search", async () => {
    await db
      .update(user)
      .set({ privacySettings: { ...DEFAULT_PRIVACY_SETTINGS, hide_from_search: true } })
      .where(eq(user.id, "user_1"));
    await insertResume({
      fileHash: pdfHash,
      status: "completed",
      parsedContent: INDEXABLE_CONTENT,
    });

    expect((await claim()).status).toBe(200);

    expect(mocks.revalidate).toHaveBeenCalledWith(["avery"]);
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("keeps a site edit made after the claim started and refreshes nothing", async () => {
    await insertResume({
      fileHash: pdfHash,
      status: "completed",
      parsedContent: INDEXABLE_CONTENT,
    });
    await db.insert(siteData).values({
      id: "site_1",
      userId: "user_1",
      content: { ...INDEXABLE_CONTENT, full_name: "Edited" },
      createdAt: NOW,
      updatedAt: "2999-01-01T00:00:00.000Z",
    });

    expect((await claim()).status).toBe(200);

    const [site] = await db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(site?.resumeId).toBeNull();
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("completes without publishing when the user has no handle yet", async () => {
    await db.update(user).set({ handle: null }).where(eq(user.id, "user_1"));
    await insertResume({
      fileHash: pdfHash,
      status: "completed",
      parsedContent: INDEXABLE_CONTENT,
    });

    const response = await claim();

    expect(response.status).toBe(200);

    const [site] = await db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(site).toBeDefined();
    expect(site?.lastPublishedAt).toBeNull();
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("waits for an identical parse that is still running and starts the cache timer", async () => {
    await insertResume({ fileHash: pdfHash, status: "processing" });

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "processing", waiting_for_cache: true });

    const [row] = await readClaimed();

    expect(row).toMatchObject({ status: "waiting_for_cache", fileHash: pdfHash });
    expect(mocks.bucket.objects.has(row.r2Key)).toBe(true);
    expect(mocks.bucket.objects.has(TEMP_KEY)).toBe(false);

    expect(mocks.startResumeParse).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ kind: "await-cache", resumeId: row.id }),
    );
  });

  it("still waits when the cache timer cannot start, and logs it", async () => {
    await insertResume({ fileHash: pdfHash, status: "processing" });
    mocks.startResumeParse.mockRejectedValue(new Error("Workflow unavailable"));

    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ waiting_for_cache: true });
    expect(logLines(logged)).toContainEqual(
      expect.objectContaining({ msg: "failed to start waiting_for_cache timer" }),
    );
  });
});

describe("POST /api/resume/claim: rate limit", () => {
  beforeEach(() => {
    // Limits only apply to a production deploy (lib/rate-limit/bypass.ts).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://clickfolio.me");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function useUpTheQuota() {
    for (let index = 0; index < 5; index += 1) {
      await insertResume({
        id: `old_${index}`,
        r2Key: `users/user_1/old_${index}/resume.pdf`,
        fileHash: `old_hash_${index}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  it("answers 429 with Retry-After once the daily quota is spent, and stores nothing", async () => {
    await useUpTheQuota();

    const response = await claim();

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await readClaimed()).toHaveLength(5);
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("answers already_claimed before counting the quota", async () => {
    await useUpTheQuota();
    await insertResume({
      id: "pending_1",
      r2Key: "temp/other/resume.pdf",
      fileHash: pdfHash,
      status: "pending_claim",
    });

    const response = await claim();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ already_claimed: true });
  });
});

describe("POST /api/resume/claim: failures", () => {
  it("answers 503 and fails the row (manually retryable) when the parse workflow cannot start", async () => {
    mocks.startResumeParse.mockRejectedValue(new Error("Workflow unavailable"));

    const response = await claim();

    expect(response.status).toBe(503);

    const [row] = await readClaimed();

    expect(row).toMatchObject({
      status: "failed",
      errorMessage: "Failed to start processing. Please try again.",
    });
  });

  it("answers 503 and fails the row when the Workflow binding is missing", async () => {
    mocks.bound.workflow = false;

    const response = await claim();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
    expect((await readClaimed())[0]).toMatchObject({
      status: "failed",
      errorMessage: "Failed to start processing. Please try again.",
    });
  });

  it("gives up with 504 after the Workflow timeout, fails the row and never starts twice", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.startResumeParse.mockReturnValue(new Promise(() => {}));

    const pending = claim();

    await vi.waitFor(() => expect(mocks.startResumeParse).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.workflow + 1);

    const response = await pending;

    expect(response.status).toBe(504);
    expect(mocks.startResumeParse).toHaveBeenCalledTimes(1);
    expect((await readClaimed())[0]).toMatchObject({ status: "failed" });
  });

  // SAFETY: These literals are the two Workflow states that intake must preserve.
  it.each(["processing", "completed"] as const)(
    "keeps a %s run when its persisted Workflow start times out",
    async (status) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      mocks.startResumeParse.mockImplementation(
        async (_workflow, _id, params: { resumeId: string }) => {
          await db
            .update(resumes)
            .set({ status, parsedContent: status === "completed" ? INDEXABLE_CONTENT : null })
            .where(eq(resumes.id, params.resumeId));

          if (status === "completed") {
            await db.insert(siteData).values({
              id: "site_completed",
              userId: "user_1",
              resumeId: params.resumeId,
              content: INDEXABLE_CONTENT,
              createdAt: NOW,
              updatedAt: NOW,
            });
          }

          return new Promise(() => {});
        },
      );

      const pending = claim();

      await vi.waitFor(async () => expect((await readClaimed())[0]?.status).toBe(status));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS.workflow + 1);

      expect((await pending).status).toBe(504);
      expect((await readClaimed())[0]).toMatchObject({ status, errorMessage: null });

      if (status === "completed") {
        expect(await db.select().from(siteData)).toMatchObject([
          { resumeId: (await readClaimed())[0].id, content: INDEXABLE_CONTENT },
        ]);
      }
    },
  );

  it("answers 503 and fails the row when the R2 put fails", async () => {
    mocks.bucket.put.mockRejectedValue(new Error("R2 unavailable"));

    const response = await claim();

    expect(response.status).toBe(503);
    expect((await readClaimed())[0]).toMatchObject({
      status: "failed",
      errorMessage: "Failed to store file for processing",
    });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();
  });

  it("answers 504 after the R2 timeout without retrying the put", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.bucket.put.mockReturnValue(new Promise(() => {}));

    const pending = claim();

    await vi.waitFor(() => expect(mocks.bucket.put).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.r2 + 1);

    const response = await pending;

    expect(response.status).toBe(504);
    expect(mocks.bucket.put).toHaveBeenCalledTimes(1);
    expect((await readClaimed())[0]).toMatchObject({ status: "failed" });
  });

  it("answers 503 and fails the row when queuing the row throws", async () => {
    failUpdateNumber(1);

    const response = await claim();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });
    expect(mocks.startResumeParse).not.toHaveBeenCalled();

    // The final object was written, but the row still names the temp key and that object is
    // still there, so the retry route has a file to download.
    const [row] = await readClaimed();

    expect(row).toMatchObject({
      status: "failed",
      errorMessage: "Failed to update resume status",
      r2Key: TEMP_KEY,
    });
    expect(mocks.bucket.objects.has(TEMP_KEY)).toBe(true);
  });

  it("logs the stranded row when even marking it failed fails", async () => {
    mocks.startResumeParse.mockRejectedValue(new Error("Workflow unavailable"));
    // update #1 queues the row, update #2 marks it failed.
    failUpdateNumber(2);

    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await claim();

    expect(response.status).toBe(503);
    expect(logLines(logged)).toContainEqual(
      expect.objectContaining({ msg: "claim row could not be marked failed" }),
    );
    expect((await readClaimed())[0]?.status).toBe("queued");
  });
});

describe("POST /api/resume/claim: cookie security", () => {
  it("answers 403 when the pending_upload cookie is missing", async () => {
    const response = await claim({ key: TEMP_KEY }, { cookie: null });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Unauthorized upload attempt"),
    });
  });

  it("answers 403 when the cookie has an invalid signature", async () => {
    const cookie = `${TEMP_KEY}|${Date.now() + 30 * 60 * 1000}|invalid-signature`;

    expect((await claim({ key: TEMP_KEY }, { cookie })).status).toBe(403);
  });

  it("answers 403 when the cookie has expired", async () => {
    const cookie = await createSignedCookieValue(TEMP_KEY, TEST_SECRET, Date.now() - 1000);

    expect((await claim({ key: TEMP_KEY }, { cookie })).status).toBe(403);
  });

  it("answers 403 without echoing either key when the cookie key does not match", async () => {
    const cookieBoundKey = "temp/uuid-456/other.pdf";
    const cookie = await createSignedCookieValue(cookieBoundKey, TEST_SECRET);

    const response = await claim({ key: TEMP_KEY }, { cookie });
    const text = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(text)).toMatchObject({
      error: expect.stringContaining("key mismatch"),
      code: "FORBIDDEN",
    });
    // Keys end in the uploader's file name and gate claiming (Issue #89): never echo either.
    expect(text).not.toContain(cookieBoundKey);
    expect(text).not.toContain(TEMP_KEY);
  });

  it("answers 403 when the cookie is malformed", async () => {
    expect((await claim({ key: TEMP_KEY }, { cookie: "not-a-valid-cookie-format" })).status).toBe(
      403,
    );
  });
});
