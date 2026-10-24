import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { resumes, siteData, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { createSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";
import { startResumeParse } from "../../helpers/parse-workflow";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  userId: "user-b",
  bucketGet: vi.fn(),
}));

vi.mock("cloudflare:workers", async () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    PENDING_UPLOAD_SECRET: "ownership-test-secret",
    CLICKFOLIO_PARSE_WORKFLOW: (await import("../../helpers/parse-workflow")).parseWorkflow,
    CLICKFOLIO_R2_BUCKET: { get: mocks.bucketGet },
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db() }));

vi.mock("@/lib/auth/clerk", async (importOriginal) => {
  const { authenticateStub } = await import("@/tests/helpers/authenticate-stub");
  const { DEFAULT_PRIVACY_SETTINGS: privacySettings } = await import("@/lib/utils/privacy");

  return {
    ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
    authenticate: authenticateStub(async () => {
      const id = mocks.userId;

      if (!id) return { error: new Response(null, { status: 401 }) };

      return {
        error: null,
        user: {
          id,
          email: `${id}@example.com`,
          name: id,
          image: null,
          handle: id,
          headline: null,
          privacySettings,
          onboardingCompleted: true,
          role: "mid_level",
        },
        dbUser: { id, handle: id, clerkId: `clerk-${id}` },
      };
    }),
  };
});

vi.mock("@/lib/utils/revalidate", () => ({ revalidatePublicProfilePages: vi.fn() }));

vi.mock("@/lib/seo/indexnow-runtime", () => ({ notifyIndexNowForProfiles: vi.fn() }));

const NOW = "2026-01-01T00:00:00.000Z";
const TEMP_KEY = "temp/owner-a/resume.pdf";
const editedContent = { ...INDEXABLE_CONTENT, headline: "Updated owner headline" };
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.reset();
  mocks.db.mockReturnValue(db);
  mocks.userId = "user-b";
  mocks.bucketGet.mockResolvedValue(null);
  await db.insert(user).values(
    ["user-a", "user-b"].map((id) => ({
      id,
      clerkId: `clerk-${id}`,
      email: `${id}@example.com`,
      name: id,
      handle: id,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      createdAt: NOW,
      updatedAt: NOW,
    })),
  );
  await db.insert(resumes).values({
    id: "resume-a",
    userId: "user-a",
    r2Key: TEMP_KEY,
    fileHash: "owner-a-file-hash",
    status: "failed",
    errorMessage: "Temporary parsing failure",
    totalAttempts: 1,
    createdAt: NOW,
    parsedContent: INDEXABLE_CONTENT,
  });
  await db.insert(siteData).values({
    id: "site-a",
    userId: "user-a",
    resumeId: "resume-a",
    content: INDEXABLE_CONTENT,
    contentIndexable: true,
    themeId: "minimalist_editorial",
    createdAt: NOW,
    updatedAt: NOW,
  });
});

function jsonRequest(path: string, method: string, body: JsonValue, cookie?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (cookie) headers.set("Cookie", `pending_upload=${encodeURIComponent(cookie)}`);

  return new Request(`https://clickfolio.me/api/resume/${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

async function updateContent() {
  const { PUT } = await import("@/app/api/resume/update/route");

  return PUT(
    jsonRequest("update", "PUT", {
      content: editedContent,
      userId: "user-a",
      resume_id: "resume-a",
    }),
  );
}

async function updateTheme() {
  const { POST } = await import("@/app/api/resume/update-theme/route");

  return POST(
    jsonRequest("update-theme", "POST", {
      theme_id: "glass",
      userId: "user-a",
      resume_id: "resume-a",
    }),
  );
}

async function status(id = "resume-a") {
  const { GET } = await import("@/app/api/resume/status/route");

  return GET(
    new Request(`https://clickfolio.me/api/resume/status?resume_id=${encodeURIComponent(id)}`),
  );
}

async function retry(id = "resume-a") {
  const { POST } = await import("@/app/api/resume/retry/route");

  return POST(jsonRequest("retry", "POST", { resume_id: id }));
}

async function claim(key = TEMP_KEY, cookie?: string) {
  const { POST } = await import("@/app/api/resume/claim/route");

  return POST(jsonRequest("claim", "POST", { key }, cookie));
}

async function persistedData() {
  return {
    users: await db.select().from(user).orderBy(user.id),
    resumes: await db.select().from(resumes).orderBy(resumes.id),
    sites: await db.select().from(siteData).orderBy(siteData.id),
  };
}

describe("resume route ownership with real SQL", () => {
  it("returns 404 for B's content update despite injected A identifiers; A can update", async () => {
    const before = await persistedData();

    expect((await updateContent()).status).toBe(404);
    expect(await persistedData()).toEqual(before);

    mocks.userId = "user-a";
    expect((await updateContent()).status).toBe(200);
    const [site] = await db.select().from(siteData).where(eq(siteData.userId, "user-a"));

    expect(site?.content).toMatchObject(editedContent);
    expect(site?.resumeId).toBe("resume-a");
  });

  it("returns 404 for B's theme update despite injected A identifiers; A can update", async () => {
    const before = await persistedData();

    expect((await updateTheme()).status).toBe(404);
    expect(await persistedData()).toEqual(before);

    mocks.userId = "user-a";
    expect((await updateTheme()).status).toBe(200);
    const [site] = await db.select().from(siteData).where(eq(siteData.userId, "user-a"));

    expect(site?.themeId).toBe("glass");
    expect(site?.content).toEqual(INDEXABLE_CONTENT);
  });

  it.each(["pending_claim", "processing", "completed", "failed"] as const)(
    "denies B access to A's %s status without changing data; A can read it",
    async (resumeStatus) => {
      await db.update(resumes).set({ status: resumeStatus }).where(eq(resumes.id, "resume-a"));
      const before = await persistedData();
      const denied = await status();

      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ error: expect.stringContaining("permission") });
      expect(await persistedData()).toEqual(before);

      mocks.userId = "user-a";
      const allowed = await status();

      expect(allowed.status).toBe(200);

      if (resumeStatus === "completed") {
        expect(await allowed.json()).toMatchObject({ parsed_content: INDEXABLE_CONTENT });
      }

      expect(await persistedData()).toEqual(before);
    },
  );

  it("denies B's retry without changing A's row or starting a workflow; A can retry", async () => {
    const before = await persistedData();

    expect((await retry()).status).toBe(403);
    expect(await persistedData()).toEqual(before);
    expect(startResumeParse).not.toHaveBeenCalled();

    mocks.userId = "user-a";
    const allowed = await retry();

    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      resume_id: "resume-a",
      status: "queued",
      retry_count: 1,
    });
    const [row] = await db.select().from(resumes).where(eq(resumes.id, "resume-a"));

    expect(row).toMatchObject({
      userId: "user-a",
      status: "queued",
      retryCount: 1,
      errorMessage: null,
    });
    expect(startResumeParse).toHaveBeenCalledTimes(1);
  });

  it("does not disclose A's existing claim to B even with its signed cookie; A can recover it", async () => {
    const cookie = await createSignedCookieValue(TEMP_KEY, "ownership-test-secret");
    const before = await persistedData();

    expect((await claim(TEMP_KEY, cookie)).status).toBe(404);
    expect(await persistedData()).toEqual(before);
    expect(startResumeParse).not.toHaveBeenCalled();

    mocks.userId = "user-a";
    const allowed = await claim(TEMP_KEY, cookie);

    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ resume_id: "resume-a", already_claimed: true });
    expect(await persistedData()).toEqual(before);
  });

  it("rejects A's upload key without a cookie or with B's valid, mismatched cookie", async () => {
    const before = await persistedData();
    const cookie = await createSignedCookieValue("temp/user-b/resume.pdf", "ownership-test-secret");

    expect((await claim()).status).toBe(403);
    expect((await claim(TEMP_KEY, cookie)).status).toBe(403);
    expect((await claim("users/user-a/resume.pdf")).status).toBe(400);
    expect(await persistedData()).toEqual(before);
  });

  it.each([
    ["content update", updateContent],
    ["theme update", updateTheme],
    ["status", () => status()],
    ["retry", () => retry()],
    ["claim", () => claim()],
  ] as const)("requires authentication for %s", async (_name, call) => {
    mocks.userId = "";
    const before = await persistedData();

    expect((await call()).status).toBe(401);
    expect(await persistedData()).toEqual(before);
  });

  it.each(["missing-resume", "   ", "../../etc/passwd", "<script>", "' OR 1=1 --"])(
    "returns 404 for unknown status ID %s without touching owner data",
    async (id) => {
      const before = await persistedData();

      expect((await status(id)).status).toBe(404);
      expect(await persistedData()).toEqual(before);
    },
  );

  it("requires a status ID and returns 404 for a retry of a missing row", async () => {
    expect((await status("")).status).toBe(400);
    expect((await retry("deleted-resume")).status).toBe(404);
  });

  it("rejects the owner's retry of a completed resume without changing it", async () => {
    mocks.userId = "user-a";
    await db.update(resumes).set({ status: "completed" }).where(eq(resumes.id, "resume-a"));
    const before = await persistedData();

    expect((await retry()).status).toBe(400);
    expect(await persistedData()).toEqual(before);
    expect(startResumeParse).not.toHaveBeenCalled();
  });
});
