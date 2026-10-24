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
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";
import type { JsonValue } from "@/lib/types/json";
import { createTestDb, INDEXABLE_CONTENT } from "@/tests/helpers/pglite-db";
import { logLines } from "@/tests/helpers/log-lines";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  userId: { value: "user_1" },
  revalidate: vi.fn(),
  indexNow: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db() }));

vi.mock("@/lib/auth/clerk", async (importOriginal) => {
  const { authenticateStub } = await import("@/tests/helpers/authenticate-stub");
  const { DEFAULT_PRIVACY_SETTINGS: privacySettings } = await import("@/lib/utils/privacy");

  return {
    ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
    authenticate: authenticateStub(async () => {
      const id = mocks.userId.value;

      if (!id) return { error: new Response(null, { status: 401 }) };

      return {
        error: null,
        user: {
          id,
          email: `${id}@example.com`,
          name: null,
          image: null,
          handle: "avery",
          headline: null,
          privacySettings,
          onboardingCompleted: true,
          role: "mid_level",
        },
        dbUser: { id, handle: "avery", clerkId: `clerk_${id}` },
      };
    }),
  };
});

vi.mock("@/lib/utils/revalidate", () => ({ revalidatePublicProfilePages: mocks.revalidate }));

vi.mock("@/lib/seo/indexnow-runtime", () => ({ notifyIndexNowForProfiles: mocks.indexNow }));

const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

function connectionLost(): Error {
  return Object.assign(new Error("connection terminated unexpectedly"), { code: "08006" });
}

function jsonRequest(url: string, method: string, body: JsonValue): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function insertUsers(name = "Avery") {
  await testDb.db.insert(user).values([
    {
      id: "user_1",
      name,
      email: "user_1@example.com",
      handle: "avery",
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "user_2",
      name: "Blake",
      email: "user_2@example.com",
      handle: "blake",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]);
}

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  mocks.db.mockReset().mockImplementation(() => testDb.db);
  mocks.revalidate.mockReset();
  mocks.indexNow.mockReset();
  mocks.userId.value = "user_1";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/resume/status", () => {
  const url = (id: string | null) =>
    `https://clickfolio.me/api/resume/status${id ? `?resume_id=${id}` : ""}`;

  async function insertResume(id: string, userId: string, status: "failed" | "completed") {
    await testDb.db.insert(resumes).values({
      id,
      userId,
      r2Key: `users/${userId}/1/resume.pdf`,
      status,
      errorMessage: status === "failed" ? "Could not read the PDF" : null,
      parsedContent: status === "completed" ? INDEXABLE_CONTENT : null,
      createdAt: NOW,
    });
  }

  it("answers 400 without a resume_id", async () => {
    await insertUsers();

    const { GET } = await import("@/app/api/resume/status/route");

    expect((await GET(new Request(url(null)))).status).toBe(400);
  });

  it("answers 401 for a signed-out visitor", async () => {
    mocks.userId.value = "";

    const { GET } = await import("@/app/api/resume/status/route");

    expect((await GET(new Request(url("resume_1")))).status).toBe(401);
  });

  it("answers 404 for an unknown resume and 403 for another user's", async () => {
    await insertUsers();
    await insertResume("resume_2", "user_2", "failed");

    const { GET } = await import("@/app/api/resume/status/route");

    expect((await GET(new Request(url("missing")))).status).toBe(404);
    expect((await GET(new Request(url("resume_2")))).status).toBe(403);
  });

  it("answers the failure message of the owner's failed resume", async () => {
    await insertUsers();
    await insertResume("resume_1", "user_1", "failed");

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(new Request(url("resume_1")));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "failed",
      error: "Could not read the PDF",
    });
  });

  it("answers the parsed content of a completed resume", async () => {
    await insertUsers();
    await insertResume("resume_1", "user_1", "completed");

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(new Request(url("resume_1")));

    const body: { status: string; progress_pct: number; parsed_content: { full_name: string } } =
      await response.json();

    expect(body).toMatchObject({ status: "completed", progress_pct: 100 });
    expect(body.parsed_content.full_name).toBe("Avery Johnson");
  });

  it("answers 503 DATABASE_ERROR, not an unhandled 500, when the read loses its connection", async () => {
    await insertUsers();
    vi.spyOn(testDb.db.query.resumes, "findFirst").mockImplementation(() => {
      throw connectionLost();
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(new Request(url("resume_1")));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("POST /api/resume/update-theme", () => {
  const post = (body: JsonValue) =>
    jsonRequest("https://clickfolio.me/api/resume/update-theme", "POST", body);

  async function insertSite() {
    await testDb.db.insert(siteData).values({
      id: "site_1",
      userId: "user_1",
      content: INDEXABLE_CONTENT,
      themeId: "minimalist_editorial",
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  it("stores the theme and purges the caches", async () => {
    await insertUsers();
    await insertSite();

    const { POST } = await import("@/app/api/resume/update-theme/route");
    const response = await POST(post({ theme_id: "bento" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, theme_id: "bento" });

    const [row] = await testDb.db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(row?.themeId).toBe("bento");
    expect(mocks.revalidate).toHaveBeenCalledWith(["avery"]);
  });

  it.each([
    ["no theme_id", {}],
    ["a numeric theme_id", { theme_id: 4 }],
    ["a null body", null],
  ])("answers 400 for %s", async (_label, body) => {
    await insertUsers();

    const { POST } = await import("@/app/api/resume/update-theme/route");

    expect((await POST(post(body))).status).toBe(400);
  });

  it("answers 400 listing the valid themes for an unknown theme_id", async () => {
    await insertUsers();

    const { POST } = await import("@/app/api/resume/update-theme/route");
    const response = await POST(post({ theme_id: "nope" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ details: { valid_themes: expect.any(Array) } });
  });

  it("answers 404 when the user has no portfolio yet", async () => {
    await insertUsers();

    const { POST } = await import("@/app/api/resume/update-theme/route");

    expect((await POST(post({ theme_id: "bento" }))).status).toBe(404);
  });

  it("answers 503 and purges nothing when the write loses its connection", async () => {
    await insertUsers();
    await insertSite();
    vi.spyOn(testDb.db, "update").mockImplementation(() => {
      throw connectionLost();
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/resume/update-theme/route");
    const response = await POST(post({ theme_id: "bento" }));

    expect(response.status).toBe(503);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("PUT /api/resume/update", () => {
  const put = (body: JsonValue) =>
    jsonRequest("https://clickfolio.me/api/resume/update", "PUT", body);

  async function insertSite() {
    await testDb.db.insert(siteData).values({
      id: "site_1",
      userId: "user_1",
      content: { ...INDEXABLE_CONTENT, full_name: "Old Name" },
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  it("stores the content, flags it indexable and purges the caches", async () => {
    await insertUsers();
    await insertSite();

    const { PUT } = await import("@/app/api/resume/update/route");
    const response = await PUT(put({ content: INDEXABLE_CONTENT }));

    expect(response.status).toBe(200);

    const [row] = await testDb.db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(row?.content.full_name).toBe("Avery Johnson");
    expect(row?.contentIndexable).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledWith(["avery"]);
  });

  it("fills a missing display name from the saved content", async () => {
    await insertUsers("Unnamed");
    await insertSite();

    const { PUT } = await import("@/app/api/resume/update/route");

    expect((await PUT(put({ content: INDEXABLE_CONTENT }))).status).toBe(200);

    const [row] = await testDb.db.select().from(user).where(eq(user.id, "user_1"));

    expect(row?.name).toBe("Avery Johnson");
  });

  it("answers 400 for a content that fails validation or a null body", async () => {
    await insertUsers();
    await insertSite();

    const { PUT } = await import("@/app/api/resume/update/route");

    expect((await PUT(put({ content: { full_name: "" } }))).status).toBe(400);
    expect((await PUT(put(null))).status).toBe(400);
  });

  it("answers 404 when the user has no portfolio yet", async () => {
    await insertUsers();

    const { PUT } = await import("@/app/api/resume/update/route");

    expect((await PUT(put({ content: INDEXABLE_CONTENT }))).status).toBe(404);
  });

  it("keeps the saved edit and the cache purge when only the display-name sync fails", async () => {
    await insertUsers("Unnamed");
    await insertSite();

    const original = testDb.db.update.bind(testDb.db);
    let calls = 0;

    vi.spyOn(testDb.db, "update").mockImplementation((table) => {
      calls += 1;

      // The first update is the site_data write; the second is the display-name sync.
      if (calls === 2) throw connectionLost();

      return original(table);
    });

    const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { PUT } = await import("@/app/api/resume/update/route");
    const response = await PUT(put({ content: INDEXABLE_CONTENT }));

    expect(response.status).toBe(200);
    expect(mocks.revalidate).toHaveBeenCalledWith(["avery"]);
    expect(logLines(logged)).toContainEqual(
      expect.objectContaining({ msg: "display name sync after resume update failed" }),
    );

    const [row] = await testDb.db.select().from(siteData).where(eq(siteData.userId, "user_1"));

    expect(row?.content.full_name).toBe("Avery Johnson");
  });

  it("answers 503 when the content write loses its connection", async () => {
    await insertUsers();
    await insertSite();
    vi.spyOn(testDb.db, "update").mockImplementation(() => {
      throw connectionLost();
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { PUT } = await import("@/app/api/resume/update/route");

    expect((await PUT(put({ content: INDEXABLE_CONTENT }))).status).toBe(503);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
