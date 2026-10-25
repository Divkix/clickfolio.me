import { serverHandler } from "@/tests/helpers/server-route";
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
import { handleChanges, siteData, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { NOW, seedUser, sessionRequest, signedInAs } from "../../helpers/clerk-session";
import { createTestDb, INDEXABLE_CONTENT, type TestDb } from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  revalidate: vi.fn(),
  indexNow: vi.fn(),
}));

vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn() }));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    APP_URL: "https://clickfolio.me",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
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
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://clickfolio.me");
  await testDb.reset();
  await seedUser(db, "alice", { handle: null, onboardingCompleted: false });
  await seedUser(db, "bob");
  signedInAs("clerk-alice");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  mocks.revalidate.mockClear();
  mocks.indexNow.mockClear();
});

const PRIVACY = { show_phone: false, show_address: true, show_in_directory: false };

function complete(body: JsonValue, headers: Record<string, string> = {}): Request {
  return completeRaw(JSON.stringify(body), headers);
}

function completeRaw(text: string, headers: Record<string, string> = {}): Request {
  return sessionRequest("https://clickfolio.me/api/wizard/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: text,
  });
}

function validBody(overrides: Record<string, JsonValue> = {}) {
  return { handle: "alice-site", privacy_settings: PRIVACY, theme_id: "bento", ...overrides };
}

async function rowOf(id: string) {
  const [row] = await db.select().from(user).where(eq(user.id, id));

  return row;
}

async function siteOf(userId: string) {
  const [row] = await db.select().from(siteData).where(eq(siteData.userId, userId));

  return row;
}

async function auditOf(userId: string) {
  return db.select().from(handleChanges).where(eq(handleChanges.userId, userId));
}

describe("POST /api/wizard/complete", () => {
  it("first-time onboarding claims the handle, privacy, theme and one audit row", async () => {
    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");

    const response = await POST(complete(validBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, handle: "alice-site" });

    const row = await rowOf("alice");

    expect(row.handle).toBe("alice-site");
    expect(row.onboardingCompleted).toBe(true);
    expect(row.privacySettings).toEqual({ ...PRIVACY, hide_from_search: false });
    expect(row.showInDirectory).toBe(false);

    const site = await siteOf("alice");

    expect(site.themeId).toBe("bento");
    expect(site.content.full_name).toBe("Pending");
    expect(site.contentIndexable).toBe(false);

    const audit = await auditOf("alice");

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ oldHandle: null, newHandle: "alice-site" });
    expect(mocks.revalidate).toHaveBeenCalledWith([null, "alice-site"]);
    expect(mocks.indexNow).toHaveBeenCalledWith([null, "alice-site"], { skipDebounce: true });
  });

  it("renames an existing handle, audits it and refreshes both public pages", async () => {
    await db.update(user).set({ handle: "old-handle" }).where(eq(user.id, "alice"));

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(200);
    expect((await rowOf("alice")).handle).toBe("alice-site");

    const audit = await auditOf("alice");

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ oldHandle: "old-handle", newHandle: "alice-site" });
    expect(mocks.revalidate).toHaveBeenCalledWith(["old-handle", "alice-site"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["old-handle", "alice-site"], {
      skipDebounce: true,
    });
  });

  it("keeps a published resume's content and only switches the theme", async () => {
    await db.insert(siteData).values({
      id: "sd-alice",
      userId: "alice",
      content: INDEXABLE_CONTENT,
      contentIndexable: true,
      themeId: "midnight",
      createdAt: NOW,
      updatedAt: NOW,
    });

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(200);

    const site = await siteOf("alice");

    expect(site.themeId).toBe("bento");
    expect(site.content.full_name).toBe(INDEXABLE_CONTENT.full_name);
  });

  it("does not overwrite a site_data row that moved on after the request read it", async () => {
    await db.insert(siteData).values({
      id: "sd-alice",
      userId: "alice",
      content: INDEXABLE_CONTENT,
      contentIndexable: true,
      themeId: "midnight",
      createdAt: NOW,
      updatedAt: NOW,
    });

    // A parse completion publishes between the request's read and its write.
    const realTransaction = db.transaction.bind(db);

    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await db
        .update(siteData)
        .set({ themeId: "glass", updatedAt: "2026-06-01T00:00:00.000Z" })
        .where(eq(siteData.userId, "alice"));

      return realTransaction(run, config);
    });

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(200);
    expect((await siteOf("alice")).themeId).toBe("glass");
  });

  it("answers 429 when an onboarded user changes handle a fourth time in 24 hours", async () => {
    await db.update(user).set({ handle: "old-handle" }).where(eq(user.id, "alice"));

    const recent = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

    await db.insert(handleChanges).values(
      ["one", "two", "three"].map((name) => ({
        id: `hc-${name}`,
        userId: "alice",
        oldHandle: null,
        newHandle: name,
        createdAt: recent,
      })),
    );

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(3500);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(3600);
    expect(await response.json()).toMatchObject({
      error: "Rate limit exceeded. Maximum 3 handle change per 24 hour(s). Try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
    expect((await rowOf("alice")).handle).toBe("old-handle");
    expect(await siteOf("alice")).toBeUndefined();
  });

  it("skips the quota and the audit row when the handle does not change", async () => {
    await db.update(user).set({ handle: "alice-site" }).where(eq(user.id, "alice"));

    const recent = new Date().toISOString();

    await db.insert(handleChanges).values(
      ["one", "two", "three"].map((name) => ({
        id: `hc-${name}`,
        userId: "alice",
        oldHandle: null,
        newHandle: name,
        createdAt: recent,
      })),
    );

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(200);
    expect(await auditOf("alice")).toHaveLength(3);
  });

  it("answers 409 with the same message when another user has the handle", async () => {
    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody({ handle: "handle-bob" })));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "This handle is already taken. Please choose another.",
      code: "CONFLICT",
    });
    expect((await rowOf("alice")).handle).toBeNull();
  });

  it("answers 400 for a reserved handle", async () => {
    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody({ handle: "api" })));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "This handle is reserved. Please choose a different one.",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 409 when the unique index wins a race the availability check lost", async () => {
    const realTransaction = db.transaction.bind(db);

    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await seedUser(db, "carol", { handle: "alice-site" });

      return realTransaction(run, config);
    });

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "This handle was just taken. Please choose a different one.",
      code: "CONFLICT",
    });
    expect((await rowOf("alice")).handle).toBeNull();
    expect(await siteOf("alice")).toBeUndefined();
  });

  it("answers 409 when the profile changed between the read and the write", async () => {
    await db.update(user).set({ handle: "first-handle" }).where(eq(user.id, "alice"));

    const realTransaction = db.transaction.bind(db);

    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await db.update(user).set({ handle: "elsewhere" }).where(eq(user.id, "alice"));

      return realTransaction(run, config);
    });

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Your profile was updated elsewhere. Please reload and try again.",
      code: "CONFLICT",
    });
    expect((await rowOf("alice")).handle).toBe("elsewhere");
  });

  it.each([
    validBody({ theme_id: "not_a_theme" }),
    validBody({ handle: "x" }),
    validBody({ privacy_settings: { show_phone: "yes" } }),
    {},
  ])("answers 400 for the invalid body %j", async (body) => {
    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Validation failed. Please check your input.",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "You must be logged in to complete onboarding",
    });
  });

  it("answers 400 for malformed JSON and 413 for an oversized declared body", async () => {
    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");

    expect((await POST(completeRaw("{nope"))).status).toBe(400);
    expect((await POST(complete(validBody(), { "Content-Length": "9999999" }))).status).toBe(413);
  });
});

describe("POST /api/wizard/complete when the database fails", () => {
  it("answers 503 and publishes nothing when the transaction cannot run", async () => {
    vi.spyOn(db, "transaction").mockRejectedValueOnce(
      Object.assign(new Error("connection terminated"), { code: "08006" }),
    );

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(503);
    expect((await rowOf("alice")).handle).toBeNull();
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("tells a rate-limited client when to come back", async () => {
    await db.update(user).set({ handle: "old-handle" }).where(eq(user.id, "alice"));

    const recent = new Date().toISOString();

    await db.insert(handleChanges).values(
      ["one", "two", "three"].map((name) => ({
        id: `hc-${name}`,
        userId: "alice",
        oldHandle: null,
        newHandle: name,
        createdAt: recent,
      })),
    );

    const POST = serverHandler((await import("@/app/routes/api/wizard/complete")).Route, "POST");
    const response = await POST(complete(validBody()));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
