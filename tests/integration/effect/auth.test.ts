import { isRedirect } from "@tanstack/react-router";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
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
import { getServerSession } from "@/lib/auth/session";
import { requireAdminAuth } from "@/lib/auth/admin";
import { withAdminEffect, withUserEffect } from "@/lib/auth/with-auth";
import { resumes, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { createSuccessResponse } from "@/lib/utils/security-headers";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

interface DbHolder {
  db: TestDb | null;
}

const holder = vi.hoisted(() => {
  const value: DbHolder = { db: null };

  return value;
});

const mocks = vi.hoisted(() => ({
  getUser: vi.fn<(clerkId: string) => Promise<{ raw: unknown }>>(),
}));

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: { getUser: mocks.getUser } })),
}));

vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    APP_URL: "https://clickfolio.me",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

const mockVerifyToken = vi.mocked(verifyToken);

const mockGetRequest = vi.mocked(getRequest);

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

const NOW = "2026-01-01T00:00:00.000Z";

function tokenError(reason: string): Error {
  return Object.assign(new Error(`Clerk said ${reason}`), { reason });
}

let sessionRequest = new Request("https://clickfolio.me");

/** Signs in both entry points: the request a route receives and Start's request store pages read. */
function signedInAs(clerkId: string | null) {
  sessionRequest = new Request("https://clickfolio.me", {
    headers: clerkId ? { Cookie: "__session=jwt" } : {},
  });
  mockGetRequest.mockReturnValue(sessionRequest);

  if (clerkId) {
    mockVerifyToken.mockResolvedValue({
      __raw: "jwt",
      iss: "https://clerk.test",
      sub: clerkId,
      sid: "sess_1",
      nbf: 0,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
  }
}

async function seedUser(clerkId: string, isAdmin = false) {
  await db.insert(user).values({
    id: `row-${clerkId}`,
    name: "Test User",
    email: `${clerkId}@example.com`,
    clerkId,
    handle: `handle-${clerkId}`,
    isAdmin,
    onboardingCompleted: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function clerkUser(clerkId: string, externalId: string | null = null) {
  return {
    raw: {
      id: clerkId,
      external_id: externalId,
      first_name: "Ada",
      last_name: "Lovelace",
      image_url: "https://img.clerk.test/ada.png",
      primary_email_address_id: "email_1",
      email_addresses: [
        {
          id: "email_1",
          email_address: `${clerkId}@example.com`,
          verification: { status: "verified" },
        },
      ],
    },
  };
}

const ok = Effect.sync(() => createSuccessResponse({ ok: true }));

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
  holder.db = db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.getUser.mockImplementation(async (clerkId) => clerkUser(clerkId));
  await testDb.reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withUserEffect", () => {
  it("hands the handler the signed-in user and the Db service", async () => {
    await seedUser("user_a");
    signedInAs("user_a");

    const response = await withUserEffect(sessionRequest, (context) =>
      Db.use((service) => service.query("test.count", (handle) => handle.select().from(user))).pipe(
        Effect.map((rows) =>
          createSuccessResponse({
            id: context.user.id,
            clerkId: context.dbUser.clerkId,
            rows: rows.length,
          }),
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "row-user_a",
      clerkId: "user_a",
      rows: 1,
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(createClerkClient).not.toHaveBeenCalled();
  });

  it("answers 401 with the caller's message when signed out", async () => {
    signedInAs(null);

    const response = await withUserEffect(sessionRequest, () => ok, "Sign in to continue");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to continue", code: "UNAUTHORIZED" });
    expect(mockVerifyToken).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("answers 401 for an expired token", async () => {
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("token-expired"));

    const response = await withUserEffect(sessionRequest, () => ok);

    expect(response.status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("answers 404 when a verified token belongs to an identity Clerk deleted", async () => {
    signedInAs("user_missing");
    mocks.getUser.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    const insert = vi.spyOn(db, "insert");

    const response = await withUserEffect(sessionRequest, () => ok);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "User account not found. Please re-authenticate.",
      code: "NOT_FOUND",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user_missing");
  });

  it("answers 503, not 401, when Clerk's key set cannot be loaded", async () => {
    await seedUser("user_a");
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("jwk-remote-failed-to-load"));

    const response = await withUserEffect(sessionRequest, () => ok);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("provisions a verified identity before its webhook so API handlers can use the row", async () => {
    signedInAs("user_new");

    const response = await withUserEffect(sessionRequest, ({ user: current, dbUser }) =>
      Effect.succeed(createSuccessResponse({ user: current, dbUser })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "user_new", name: "Ada Lovelace", onboardingCompleted: false },
      dbUser: { id: "user_new", clerkId: "user_new", handle: null },
    });
    expect(await db.select().from(user)).toMatchObject([
      { id: "user_new", clerkId: "user_new", emailVerified: true },
    ]);
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user_new");

    expect((await withUserEffect(sessionRequest, () => ok)).status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("links the trusted external id without replacing the legacy row or its resumes", async () => {
    await seedUser("user_legacy");
    await db.update(user).set({ clerkId: null }).where(eq(user.id, "row-user_legacy"));
    await db.insert(resumes).values({
      id: "resume_legacy",
      userId: "row-user_legacy",
      r2Key: "users/row-user_legacy/resume.pdf",
      status: "completed",
      createdAt: NOW,
    });
    signedInAs("user_new");
    mocks.getUser.mockResolvedValue(clerkUser("user_new", "row-user_legacy"));

    const response = await withUserEffect(sessionRequest, ({ user: current }) =>
      Effect.succeed(createSuccessResponse({ id: current.id, handle: current.handle })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "row-user_legacy",
      handle: "handle-user_legacy",
    });
    expect(await db.select().from(user)).toHaveLength(1);
    expect(await db.select().from(resumes)).toMatchObject([
      { id: "resume_legacy", userId: "row-user_legacy" },
    ]);
  });

  it("uses the row a concurrent webhook inserted after mapping was read, without retrying a write", async () => {
    signedInAs("user_race");
    const findFirst = db.query.user.findFirst.bind(db.query.user);
    const insert = vi.spyOn(db, "insert");

    vi.spyOn(db.query.user, "findFirst").mockImplementationOnce((config) => {
      const query = findFirst(config);
      const execute = query.execute.bind(query);

      vi.spyOn(query, "execute").mockImplementationOnce(async () => {
        const row = await execute();

        await seedUser("user_race");

        return row;
      });

      return query;
    });

    const response = await withUserEffect(sessionRequest, ({ user: current }) =>
      Effect.succeed(createSuccessResponse({ id: current.id })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "row-user_race" });
    expect(await db.select().from(user)).toHaveLength(1);
    // One competing insert and one PostgreSQL 23505: never a fallback/retry insert.
    expect(insert).toHaveBeenCalledTimes(2);
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user_race");
  });

  it("does not retry a provisioning write after a database timeout", async () => {
    signedInAs("user_new");

    const insert = vi.spyOn(db, "insert").mockImplementation(() => {
      throw Object.assign(new Error("database write timed out"), { name: "TimeoutError" });
    });

    const response = await withUserEffect(sessionRequest, () => ok);

    expect(response.status).toBe(504);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user_new");
  });

  it("surfaces a Backend API outage as 503 rather than a missing or signed-out user", async () => {
    signedInAs("user_new");
    mocks.getUser.mockRejectedValue(Object.assign(new Error("unavailable"), { status: 503 }));

    const response = await withUserEffect(sessionRequest, () => ok);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    expect(await db.select().from(user)).toHaveLength(0);
  });
});

describe("withAdminEffect", () => {
  it("runs the handler for an admin", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    const response = await withAdminEffect(sessionRequest, (context) =>
      Effect.succeed(createSuccessResponse({ id: context.user.id })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "row-user_admin" });
  });

  it("answers 403 for a signed-in non-admin", async () => {
    await seedUser("user_a");
    signedInAs("user_a");

    const response = await withAdminEffect(sessionRequest, () => ok);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required", code: "FORBIDDEN" });
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const response = await withAdminEffect(sessionRequest, () => ok);

    expect(response.status).toBe(401);
  });

  it("re-reads isAdmin from the database on every request", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    expect((await withAdminEffect(sessionRequest, () => ok)).status).toBe(200);

    await db.update(user).set({ isAdmin: false }).where(eq(user.clerkId, "user_admin"));

    expect((await withAdminEffect(sessionRequest, () => ok)).status).toBe(403);
  });

  it("answers 503 when Clerk is unavailable instead of denying as signed out", async () => {
    signedInAs("user_admin");
    mockVerifyToken.mockRejectedValue(new TypeError("fetch failed"));

    const response = await withAdminEffect(sessionRequest, () => ok);

    expect(response.status).toBe(503);
  });
});

describe("getServerSession", () => {
  it("returns the session for a signed-in user", async () => {
    await seedUser("user_a", true);
    signedInAs("user_a");

    const session = await getServerSession();

    expect(session?.user).toMatchObject({ id: "row-user_a", isAdmin: true });
    expect(session?.session.id).toBe("sess_1");
  });

  it("returns null when signed out, when the token is expired and when Clerk deleted the identity", async () => {
    signedInAs(null);
    await expect(getServerSession()).resolves.toBeNull();

    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("token-expired"));
    await expect(getServerSession()).resolves.toBeNull();

    signedInAs("user_missing");
    mocks.getUser.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    await expect(getServerSession()).resolves.toBeNull();
  });

  it("returns a page session before the new identity's webhook arrives", async () => {
    signedInAs("user_new");

    await expect(getServerSession()).resolves.toMatchObject({
      user: {
        id: "user_new",
        name: "Ada Lovelace",
        onboardingCompleted: false,
        isAdmin: false,
      },
      session: { id: "sess_1", userId: "user_new" },
    });
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user_new");
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("throws to the page error boundary when provisioning cannot read Clerk", async () => {
    signedInAs("user_new");
    mocks.getUser.mockRejectedValue(Object.assign(new Error("unavailable"), { status: 503 }));

    await expect(getServerSession()).rejects.toThrow(/temporarily unavailable/);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("throws to the error boundary when Clerk is down, not null (which would redirect home)", async () => {
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("jwk-remote-failed-to-load"));

    await expect(getServerSession()).rejects.toThrow(/temporarily unavailable/);
  });

  it("fails rather than reading as signed out when getRequest() itself breaks", async () => {
    mockGetRequest.mockImplementation(() => {
      throw new Error("request context exploded");
    });

    await expect(getServerSession()).rejects.toThrow();
  });
});

describe("requireAdminAuth", () => {
  it("redirects a signed-out visitor home, outside any Effect", async () => {
    signedInAs(null);

    await expect(requireAdminAuth()).rejects.toSatisfy(
      (cause: unknown) => isRedirect(cause) && cause.options.to === "/",
    );
  });

  it("redirects a non-admin to the dashboard", async () => {
    await seedUser("user_a");
    signedInAs("user_a");

    await expect(requireAdminAuth()).rejects.toSatisfy(
      (cause: unknown) => isRedirect(cause) && cause.options.to === "/dashboard",
    );
  });

  it("returns the admin", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    await expect(requireAdminAuth()).resolves.toMatchObject({ id: "row-user_admin" });
  });

  it("does not turn a Clerk outage into a redirect", async () => {
    signedInAs("user_admin");
    mockVerifyToken.mockRejectedValue(new TypeError("fetch failed"));

    await expect(requireAdminAuth()).rejects.toThrow(/temporarily unavailable/);
  });
});
