import { eq, sql } from "drizzle-orm";
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
import { handleChanges, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import { NOW, seedUser, signedInAs } from "../../helpers/clerk-session";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  revalidate: vi.fn(),
  indexNow: vi.fn(),
}));

vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

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
  await seedUser(db, "alice");
  await seedUser(db, "bob");
  signedInAs("clerk-alice");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await db.execute(sql`DROP TRIGGER IF EXISTS skip_user_update ON "user"`);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  mocks.revalidate.mockClear();
  mocks.indexNow.mockClear();
});

function put(path: string, body: JsonValue, headers: Record<string, string> = {}): Request {
  return putRaw(path, JSON.stringify(body), headers);
}

function putRaw(path: string, text: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://clickfolio.me/api/profile/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: text,
  });
}

async function rowOf(id: string) {
  const [row] = await db.select().from(user).where(eq(user.id, id));

  return row;
}

/**
 * Makes every `UPDATE "user"` touch zero rows, the way a row that disappears between the auth
 * read and the write does. Dropped again in `afterEach`; `OR REPLACE` keeps repeat calls cheap.
 */
async function skipUserUpdates() {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION skip_user_update() RETURNS trigger AS $$
      BEGIN RETURN NULL; END;
    $$ LANGUAGE plpgsql
  `);
  await db.execute(sql`
    CREATE TRIGGER skip_user_update BEFORE UPDATE ON "user"
      FOR EACH ROW EXECUTE FUNCTION skip_user_update()
  `);
}

describe("PUT /api/profile/handle", () => {
  it("changes the handle, writes the audit row and refreshes both public pages", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");

    const response = await PUT(put("handle", { handle: "alice-new" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      handle: "alice-new",
      old_handle: "handle-alice",
    });
    expect((await rowOf("alice")).handle).toBe("alice-new");

    const audit = await db.select().from(handleChanges).where(eq(handleChanges.userId, "alice"));

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ oldHandle: "handle-alice", newHandle: "alice-new" });
    expect(mocks.revalidate).toHaveBeenCalledWith(["handle-alice", "alice-new"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["handle-alice", "alice-new"], {
      skipDebounce: true,
    });
  });

  it("only ever writes the caller's own row, whatever the body says", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");

    const response = await PUT(put("handle", { handle: "alice-new", id: "bob", user_id: "bob" }));

    expect(response.status).toBe(200);
    expect((await rowOf("bob")).handle).toBe("handle-bob");
  });

  it("answers 409 when another user already has the handle", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");

    const response = await PUT(put("handle", { handle: "handle-bob" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "This handle is already taken. Please choose a different one.",
      code: "CONFLICT",
    });
    expect((await rowOf("alice")).handle).toBe("handle-alice");
  });

  it("answers 409 when the unique index wins a race the availability check lost", async () => {
    // The availability check passes; another account takes the handle before the write lands.
    const realTransaction = db.transaction.bind(db);

    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await seedUser(db, "carol", { handle: "handle-race" });

      return realTransaction(run, config);
    });

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "handle-race" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "This handle was just taken. Please choose a different one.",
      code: "CONFLICT",
    });
  });

  it.each(["ab", "a".repeat(31), "Has-Caps", "-leading", "double--hyphen"])(
    "answers 400 for the malformed handle %j",
    async (handle) => {
      const { PUT } = await import("@/app/api/profile/handle/route");
      const response = await PUT(put("handle", { handle }));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Invalid handle format",
        code: "VALIDATION_ERROR",
      });
    },
  );

  it("answers 400 for a reserved handle", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "api" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "This handle is reserved. Please choose a different one.",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 400 when the handle is unchanged", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "handle-alice" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Handle is already set to this value",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 429 after three changes in 24 hours, without touching the handle", async () => {
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

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "alice-fourth" }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(3500);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(3600);
    expect(await response.json()).toMatchObject({
      error: "Rate limit exceeded. Maximum 3 handle change per 24 hour(s). Try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
    expect((await rowOf("alice")).handle).toBe("handle-alice");
  });

  it("does not count changes older than the window", async () => {
    await db.insert(handleChanges).values(
      ["one", "two", "three"].map((name) => ({
        id: `hc-${name}`,
        userId: "alice",
        oldHandle: null,
        newHandle: name,
        createdAt: "2020-01-01T00:00:00.000Z",
      })),
    );

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "alice-fourth" }));

    expect(response.status).toBe(200);
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "alice-new" }));

    expect(response.status).toBe(401);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(putRaw("handle", "{not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid JSON in request body" });
  });

  it("answers 413 when Content-Length is over the limit", async () => {
    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "x" }, { "Content-Length": "9999999" }));

    expect(response.status).toBe(413);
  });
});

describe("PUT /api/profile/privacy", () => {
  const settings = {
    show_phone: true,
    show_address: false,
    hide_from_search: true,
    show_in_directory: false,
  };

  it("keeps the jsonb settings and the show_in_directory column in step", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(put("privacy", settings));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, privacy_settings: settings });

    const row = await rowOf("alice");

    expect(row.privacySettings).toEqual(settings);
    expect(row.showInDirectory).toBe(false);
    expect(mocks.revalidate).toHaveBeenCalledWith(["handle-alice"]);
    expect(mocks.indexNow).toHaveBeenCalledWith(["handle-alice"], { skipDebounce: true });
  });

  it("never touches another user's settings", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");

    await PUT(put("privacy", { ...settings, id: "bob", user_id: "bob" }));

    const bob = await rowOf("bob");

    expect(bob.privacySettings.hide_from_search).toBe(false);
    expect(bob.showInDirectory).toBe(true);
  });

  it("writes when If-Unmodified-Since still matches the stored version", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(put("privacy", settings, { "If-Unmodified-Since": NOW }));

    expect(response.status).toBe(200);
    expect((await rowOf("alice")).showInDirectory).toBe(false);
  });

  it("answers 409 and writes nothing when the version moved on", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(
      put("privacy", settings, { "If-Unmodified-Since": "2025-12-31T00:00:00.000Z" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Settings changed elsewhere, reload",
      code: "CONFLICT",
    });
    expect((await rowOf("alice")).showInDirectory).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("answers 404 and revalidates nothing when the unguarded write matches no row", async () => {
    await skipUserUpdates();

    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(put("privacy", settings));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "User not found", code: "NOT_FOUND" });
    expect((await rowOf("alice")).privacySettings.hide_from_search).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("answers 500, not 409, for an If-Unmodified-Since that is not a timestamp", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(put("privacy", settings, { "If-Unmodified-Since": "garbage" }));

    expect(response.status).toBe(500);
    expect((await rowOf("alice")).showInDirectory).toBe(true);
  });

  it.each([
    { show_phone: "yes", show_address: false, hide_from_search: false, show_in_directory: true },
    { show_phone: true },
    {},
  ])("answers 400 for invalid settings %j", async (body) => {
    const { PUT } = await import("@/app/api/profile/privacy/route");
    const response = await PUT(put("privacy", body));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid privacy settings data",
      code: "VALIDATION_ERROR",
    });
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const { PUT } = await import("@/app/api/profile/privacy/route");
    const response = await PUT(put("privacy", settings));

    expect(response.status).toBe(401);
  });

  it("answers 400 for malformed JSON", async () => {
    const { PUT } = await import("@/app/api/profile/privacy/route");
    const response = await PUT(putRaw("privacy", "{oops"));

    expect(response.status).toBe(400);
  });
});

describe("PUT /api/profile/role", () => {
  it("sets the role and marks it as chosen by the user", async () => {
    const { PUT } = await import("@/app/api/profile/role/route");

    const response = await PUT(put("role", { role: "senior" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: "senior" });

    const row = await rowOf("alice");

    expect(row.role).toBe("senior");
    expect(row.roleSource).toBe("user");
  });

  it("updates freelance status without touching the role or its source", async () => {
    await db.update(user).set({ role: "manager", roleSource: "ai" }).where(eq(user.id, "alice"));

    const { PUT } = await import("@/app/api/profile/role/route");
    const response = await PUT(put("role", { isFreelance: true }));

    expect(response.status).toBe(200);

    const row = await rowOf("alice");

    expect(row).toMatchObject({ role: "manager", roleSource: "ai", isFreelance: true });
  });

  it("never touches another user's row", async () => {
    const { PUT } = await import("@/app/api/profile/role/route");

    await PUT(put("role", { role: "senior", id: "bob" }));

    expect((await rowOf("bob")).role).toBeNull();
  });

  it.each([{ role: "wizard" }, {}, { isFreelance: "yes" }])(
    "answers 400 for the invalid body %j",
    async (body) => {
      const { PUT } = await import("@/app/api/profile/role/route");
      const response = await PUT(put("role", body));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Invalid role value",
        code: "VALIDATION_ERROR",
      });
    },
  );

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const { PUT } = await import("@/app/api/profile/role/route");
    const response = await PUT(put("role", { role: "senior" }));

    expect(response.status).toBe(401);
  });
});

describe("profile routes when the database fails", () => {
  const unavailable = () => Object.assign(new Error("connection terminated"), { code: "08006" });

  it("answers 503, not a bare 500, when the privacy write fails, and does not purge", async () => {
    vi.spyOn(db, "update").mockImplementation(() => {
      throw unavailable();
    });

    const { PUT } = await import("@/app/api/profile/privacy/route");

    const response = await PUT(
      put("privacy", {
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_ERROR" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.indexNow).not.toHaveBeenCalled();
  });

  it("answers 503 when the role write fails", async () => {
    vi.spyOn(db, "update").mockImplementation(() => {
      throw unavailable();
    });

    const { PUT } = await import("@/app/api/profile/role/route");
    const response = await PUT(put("role", { role: "senior" }));

    expect(response.status).toBe(503);
  });

  it("answers 503 when the handle transaction fails, and records nothing", async () => {
    vi.spyOn(db, "transaction").mockRejectedValueOnce(unavailable());

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "alice-new" }));

    expect(response.status).toBe(503);
    expect((await rowOf("alice")).handle).toBe("handle-alice");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("tells a rate-limited client when to come back", async () => {
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

    const { PUT } = await import("@/app/api/profile/handle/route");
    const response = await PUT(put("handle", { handle: "alice-fourth" }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
