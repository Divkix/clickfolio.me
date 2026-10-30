import type { Mock } from "vite-plus/test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { verifyToken } from "@clerk/backend";
import { env } from "cloudflare:workers";
import { PgDialect } from "drizzle-orm/pg-core";
import { user as userTable } from "@/lib/db/schema";
import { CLERK_SESSION_COOKIE } from "@/lib/auth/clerk";
import { Effect } from "effect";
import type { AuthenticatedUser } from "@/lib/auth/clerk";
import { withUserEffect } from "@/lib/auth/with-auth";

const mockVerifyToken = vi.mocked(verifyToken);

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn<(clerkId: string) => Promise<never>>(),
}));

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: { getUser } })),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    APP_URL: "https://clickfolio.me",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb.db),
}));

interface MockDb {
  db: { select: Mock };
  setRows(rows: PgRow[]): void;
  setQueryError(error: Error): void;
  select: Mock;
  from: Mock;
  where: Mock;
}

function createMockDb(): MockDb {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select },
    setRows: (rows: PgRow[]) => limit.mockResolvedValue(rows),
    setQueryError: (error: Error) => limit.mockRejectedValue(error),
    select,
    from,
    where,
  };
}

let mockDb: MockDb;

let sessionCookieValue: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

  mockDb = createMockDb();

  sessionCookieValue = undefined;

  mockVerifyToken.mockResolvedValue({
    __raw: "test-jwt",
    iss: "https://clerk.test",
    sub: "user_2clerkAbc",
    sid: "sess_2xyz",
    nbf: 0,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  });
});

// What @clerk/backend throws for a token it rejects: a TokenVerificationError with a `reason`.
function tokenError(reason: string): Error {
  return Object.assign(new Error(`Clerk rejected the token (${reason})`), { reason });
}

/** A request carrying Clerk's `__client` cookie, plus `__session` when the test sets one. */
function sessionRequest(): Request {
  const session =
    sessionCookieValue !== undefined ? `; ${CLERK_SESSION_COOKIE}=${sessionCookieValue}` : "";

  return new Request("https://clickfolio.me", {
    headers: { Cookie: `__client=uat_client_token${session}` },
  });
}

interface PgRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  handle: string;
  headline: string | null;
  privacySettings: { showEmail?: boolean; showDirectory?: boolean };
  onboardingCompleted: boolean;
  role: string;
}

function pgRow(overrides: Partial<PgRow> = {}): PgRow {
  return {
    id: "legacy-user-1",
    email: "user@test.com",
    name: "Test User",
    image: null,
    handle: "testuser",
    headline: "Engineer",
    privacySettings: { showEmail: false },
    onboardingCompleted: true,
    role: "mid_level",
    ...overrides,
  };
}

/**
 * Runs the real `withUserEffect` pipeline (cookie, Clerk verification, row lookup) and reports
 * what a route handler would see: the signed-in user, or the refusal response.
 */
async function requireAuth(message = "You must be logged in") {
  const seen: AuthenticatedUser[] = [];

  const response = await withUserEffect(
    sessionRequest(),
    (context) =>
      Effect.sync(() => {
        seen.push(context);

        return new Response(null, { status: 204 });
      }),
    message,
  );

  return {
    response,
    error: seen.length > 0 ? null : response,
    user: seen[0]?.user ?? null,
    dbUser: seen[0]?.dbUser ?? null,
  };
}

describe("Authentication Middleware Security", () => {
  describe("session verification", () => {
    it("returns 401 when no __session cookie exists", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns 401 when the __session cookie is blank", async () => {
      sessionCookieValue = "";

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
    });

    it("passes the raw cookie value and CLERK_SECRET_KEY to Clerk verification on success", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow()]);

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(mockVerifyToken).toHaveBeenCalledWith("signed-clerk-jwt-value", {
        secretKey: "sk_test_clickfolio_secret",
        authorizedParties: ["https://clickfolio.me"],
      });
    });

    it("returns user fields mapped from the Postgres row when claims verify", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow({ privacySettings: { showDirectory: true }, role: "senior" })]);

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(result.user).toEqual({
        id: "legacy-user-1",
        email: "user@test.com",
        name: "Test User",
        image: null,
        handle: "testuser",
        headline: "Engineer",
        privacySettings: { showDirectory: true },
        onboardingCompleted: true,
        role: "senior",
      });
    });
  });

  describe("user row validation", () => {
    it("returns 401 when no session exists", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
    });

    it("returns 404 when verified claims belong to an identity Clerk no longer has", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([]);

      const result = await requireAuth();

      expect(result.error?.status).toBe(404);
      // SAFETY: the error body is only read after a 404 response in this test, and
      // Response.json() carries no shape, so the assertion supplies the expected shape.
      const body = (await result.error?.json()) as { error?: string };
      expect(body.error).toContain("User account not found");
      expect(result.dbUser).toBeNull();
    });

    it("returns user and dbUser with clerkId from the verified sub claim", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow()]);

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
      expect(result.dbUser).toEqual({
        id: "legacy-user-1",
        handle: "testuser",
        clerkId: "user_2clerkAbc",
      });
      expect(result.dbUser?.clerkId).not.toBe(result.user?.id);
    });

    it("filters the row lookup on the clerk_id mapping of the verified sub", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow()]);

      await requireAuth();

      expect(mockDb.from).toHaveBeenCalledWith(userTable);

      const condition = mockDb.where.mock.calls[0]?.[0];
      expect(condition).toBeDefined();
      const { sql, params } = new PgDialect().sqlToQuery(condition);
      expect(sql).toBe('"user"."clerk_id" = $1');
      expect(params).toEqual(["user_2clerkAbc"]);
    });

    it("rejects tampered cookies instead of falling back to DB data", async () => {
      sessionCookieValue = "tampered-jwt-payload";
      mockVerifyToken.mockRejectedValue(tokenError("token-invalid-signature"));
      mockDb.setRows([pgRow({ email: "attacker@test.com" })]);

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("Session Expiration Handling", () => {
    it("rejects an expired Clerk session JWT", async () => {
      sessionCookieValue = "expired-clerk-jwt";
      mockVerifyToken.mockRejectedValue(tokenError("token-expired"));

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });

    it("accepts a session whose exp claim is still in the future", async () => {
      sessionCookieValue = "valid-unexpired-clerk-jwt";
      mockVerifyToken.mockResolvedValue({
        __raw: "test-jwt",
        iss: "https://clerk.test",
        sub: "user_2clerkAbc",
        sid: "sess_unexpired",
        nbf: 0,
        exp: Math.floor(Date.now() / 1000) + 60,
        iat: Math.floor(Date.now() / 1000),
      });
      mockDb.setRows([pgRow()]);

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
    });
  });

  describe("Session Rotation (Clerk sid)", () => {
    it("maps rotated sessions (fresh sid claim after re-login) to the same local row", async () => {
      mockDb.setRows([pgRow()]);

      sessionCookieValue = "jwt-with-session-one";
      mockVerifyToken.mockResolvedValue({
        __raw: "test-jwt",
        iss: "https://clerk.test",
        sub: "user_2clerkAbc",
        sid: "sess_old",
        nbf: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      const first = await requireAuth();

      sessionCookieValue = "jwt-with-session-two";
      mockVerifyToken.mockResolvedValue({
        __raw: "test-jwt",
        iss: "https://clerk.test",
        sub: "user_2clerkAbc",
        sid: "sess_new",
        nbf: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      const second = await requireAuth();

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(second.user?.id).toBe(first.user?.id);
    });

    it("handles multiple concurrent devices holding distinct sessions", async () => {
      mockDb.setRows([pgRow()]);
      sessionCookieValue = "jwt-from-device-b";
      mockVerifyToken.mockResolvedValue({
        __raw: "test-jwt",
        iss: "https://clerk.test",
        sub: "user_2clerkAbc",
        sid: "sess_device_b",
        nbf: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
    });
  });

  describe("Session Token Format Validation", () => {
    it("rejects non-JWT garbage in the __session cookie", async () => {
      sessionCookieValue = "valid-token-format-12345";
      mockVerifyToken.mockRejectedValue(tokenError("token-invalid"));

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Authentication Bypass Prevention", () => {
    it("rejects requests carrying only the __client device cookie", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("blocks malformed session tokens", async () => {
      sessionCookieValue = "invalid-token";
      mockVerifyToken.mockRejectedValue(tokenError("token-invalid"));

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });

    it("blocks requests with no cookies at all", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });
  });

  describe("JWT Signature Validation", () => {
    it("rejects tampered JWT signatures", async () => {
      sessionCookieValue = "jwt-with-modified-payload";
      mockVerifyToken.mockRejectedValue(tokenError("token-invalid-signature"));

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });

    it("rejects JWTs signed with an unexpected algorithm", async () => {
      sessionCookieValue = "jwt-with-alg-none";
      mockVerifyToken.mockRejectedValue(tokenError("token-invalid-algorithm"));

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });

    it("rejects verified payloads without a sub claim", async () => {
      sessionCookieValue = "unsigned-subjectless-token";
      // SAFETY: Clerk's JwtPayload requires a non-optional sub claim, but this
      // negative-path fixture is by design a verified payload WITHOUT sub, which
      // verifyClerkToken reads through optional chaining (payload?.sub).
      mockVerifyToken.mockResolvedValue({} as never);

      const result = await requireAuth();

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Fail-Closed Behavior", () => {
    it("fails closed with a 500, not a sign-out, when Clerk credentials are unconfigured", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      Reflect.deleteProperty(env, "CLERK_SECRET_KEY");

      try {
        sessionCookieValue = "otherwise-valid-jwt";
        mockDb.setRows([pgRow()]);

        const result = await requireAuth();

        expect(result.response.status).toBe(500);
        expect(result.user).toBeNull();
        expect(mockVerifyToken).not.toHaveBeenCalled();
        expect(mockDb.select).not.toHaveBeenCalled();
      } finally {
        env.CLERK_SECRET_KEY = "sk_test_clickfolio_secret";
      }
    });

    it("answers a database failure during row lookup with an error, never a sign-out", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setQueryError(new Error("Database connection lost"));

      const result = await requireAuth();

      expect(result.response.status).toBeGreaterThanOrEqual(500);
      expect(result.user).toBeNull();
    });
  });

  describe("Defense in Depth", () => {
    it("does not recreate an identity Clerk deleted even when its old JWT verifies", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([]);

      const result = await requireAuth();

      expect(result.error?.status).toBe(404);
    });

    it("resolves the row owned by the verified sub, not any other account", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow({ id: "other-user-row" })]);

      const result = await requireAuth();

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("other-user-row");
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });
  });
});
