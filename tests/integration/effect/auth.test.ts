import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
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
import { requireAuthClerk } from "@/lib/auth/clerk";
import { getServerSession } from "@/lib/auth/session";
import { requireAdminAuth } from "@/lib/auth/admin";
import { withAdminEffect, withUserEffect } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { ClerkFailed } from "@/lib/effect/failures";
import { createSuccessResponse } from "@/lib/utils/security-headers";
import { createTestDb, type TestDb } from "../../helpers/pglite-db";

interface DbHolder {
  db: TestDb | null;
}

const holder = vi.hoisted(() => {
  const value: DbHolder = { db: null };

  return value;
});

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), {
      digest: `NEXT_REDIRECT;replace;${path};307;`,
    });
  }),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
}));

const mockVerifyToken = vi.mocked(verifyToken);

const mockCookies = vi.mocked(cookies);

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

const NOW = "2026-01-01T00:00:00.000Z";

function tokenError(reason: string): Error {
  return Object.assign(new Error(`Clerk said ${reason}`), { reason });
}

function signedInAs(clerkId: string | null) {
  // SAFETY: the code under test only calls get() on the cookie store.
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "__session" && clerkId ? { name, value: "jwt" } : undefined),
  } as never);

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

    const response = await withUserEffect(undefined, (context) =>
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
  });

  it("answers 401 with the caller's message when signed out", async () => {
    signedInAs(null);

    const response = await withUserEffect(undefined, () => ok, "Sign in to continue");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to continue", code: "UNAUTHORIZED" });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("answers 401 for an expired token", async () => {
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("token-expired"));

    const response = await withUserEffect(undefined, () => ok);

    expect(response.status).toBe(401);
  });

  it("answers 404 when the JWT is valid but the user row does not exist yet", async () => {
    signedInAs("user_missing");

    const response = await withUserEffect(undefined, () => ok);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "User account not found. Please re-authenticate.",
      code: "NOT_FOUND",
    });
  });

  it("answers 503, not 401, when Clerk's key set cannot be loaded", async () => {
    await seedUser("user_a");
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("jwk-remote-failed-to-load"));

    const response = await withUserEffect(undefined, () => ok);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("lets a dynamic-usage signal from cookies() unwind instead of failing the request", async () => {
    const signal = Object.assign(new Error("DYNAMIC_SERVER_USAGE"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });

    mockCookies.mockRejectedValue(signal);

    await expect(withUserEffect(undefined, () => ok)).rejects.toBe(signal);
  });

  it("answers 500 and logs when cookies() itself breaks, rather than reading as signed out", async () => {
    mockCookies.mockRejectedValue(new Error("cookie store exploded"));

    const response = await withUserEffect(undefined, () => ok);

    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("withAdminEffect", () => {
  it("runs the handler for an admin", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    const response = await withAdminEffect(undefined, (context) =>
      Effect.succeed(createSuccessResponse({ id: context.user.id })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "row-user_admin" });
  });

  it("answers 403 for a signed-in non-admin", async () => {
    await seedUser("user_a");
    signedInAs("user_a");

    const response = await withAdminEffect(undefined, () => ok);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required", code: "FORBIDDEN" });
  });

  it("answers 401 when signed out", async () => {
    signedInAs(null);

    const response = await withAdminEffect(undefined, () => ok);

    expect(response.status).toBe(401);
  });

  it("re-reads isAdmin from the database on every request", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    expect((await withAdminEffect(undefined, () => ok)).status).toBe(200);

    await db.update(user).set({ isAdmin: false }).where(eq(user.clerkId, "user_admin"));

    expect((await withAdminEffect(undefined, () => ok)).status).toBe(403);
  });

  it("answers 503 when Clerk is unavailable instead of denying as signed out", async () => {
    signedInAs("user_admin");
    mockVerifyToken.mockRejectedValue(new TypeError("fetch failed"));

    const response = await withAdminEffect(undefined, () => ok);

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

  it("returns null when signed out, when the token is expired and when the row is missing", async () => {
    signedInAs(null);
    await expect(getServerSession()).resolves.toBeNull();

    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("token-expired"));
    await expect(getServerSession()).resolves.toBeNull();

    signedInAs("user_missing");
    await expect(getServerSession()).resolves.toBeNull();
  });

  it("throws to the error boundary when Clerk is down, not null (which would redirect home)", async () => {
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("jwk-remote-failed-to-load"));

    await expect(getServerSession()).rejects.toThrow(/temporarily unavailable/);
  });

  it("passes a dynamic-usage signal from cookies() through untouched", async () => {
    const signal = Object.assign(new Error("DYNAMIC_SERVER_USAGE"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });

    mockCookies.mockRejectedValue(signal);

    await expect(getServerSession()).rejects.toBe(signal);
  });

  it("passes a redirect signal from cookies() through untouched", async () => {
    const signal = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;307;",
    });

    mockCookies.mockRejectedValue(signal);

    await expect(getServerSession()).rejects.toBe(signal);
  });
});

describe("requireAdminAuth", () => {
  it("redirects a signed-out visitor home, outside any Effect", async () => {
    signedInAs(null);

    await expect(requireAdminAuth()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/;307;",
    });
  });

  it("redirects a non-admin to the dashboard", async () => {
    await seedUser("user_a");
    signedInAs("user_a");

    await expect(requireAdminAuth()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/dashboard;307;",
    });
  });

  it("returns the admin", async () => {
    await seedUser("user_admin", true);
    signedInAs("user_admin");

    await expect(requireAdminAuth()).resolves.toMatchObject({ id: "row-user_admin" });
  });

  it("does not turn a Clerk outage into a redirect", async () => {
    signedInAs("user_admin");
    mockVerifyToken.mockRejectedValue(new TypeError("fetch failed"));

    await expect(requireAdminAuth()).rejects.not.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("Promise API kept for routes that have not moved", () => {
  it("requireAuthClerk reports a Clerk outage by throwing, not as a 401", async () => {
    signedInAs("user_a");
    mockVerifyToken.mockRejectedValue(tokenError("jwk-remote-failed-to-load"));

    await expect(requireAuthClerk("You must be logged in")).rejects.toBeInstanceOf(ClerkFailed);
  });
});
