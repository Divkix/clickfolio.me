import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { verifyToken } from "@clerk/backend";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { PgDialect } from "drizzle-orm/pg-core";
import { getDb, type Database } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { CLERK_SESSION_COOKIE } from "@/lib/auth/clerk";
import { requireAuthWithMessage, requireAuthWithUserValidation } from "@/lib/auth/middleware";

const mockVerifyToken = vi.mocked(verifyToken);
const mockCookies = vi.mocked(cookies);
const mockGetDb = vi.mocked(getDb);

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_SECRET_KEY: "sk_test_clickfolio_secret",
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

interface MockDb {
  db: Database;
  setRows(rows: Array<Record<string, unknown>>): void;
  setQueryError(error: Error): void;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    db: { select } as unknown as Database,
    setRows: (rows: Array<Record<string, unknown>>) => limit.mockResolvedValue(rows),
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

  mockDb = createMockDb();
  mockGetDb.mockReturnValue(mockDb.db);

  sessionCookieValue = undefined;
  mockCookies.mockImplementation(
    async () =>
      ({
        get: (name: string) => {
          if (name === CLERK_SESSION_COOKIE && sessionCookieValue !== undefined) {
            return { name, value: sessionCookieValue };
          }
          if (name === "__client") {
            return { name, value: "uat_client_token" };
          }
          return undefined;
        },
      }) as never,
  );

  mockVerifyToken.mockResolvedValue({
    sub: "user_2clerkAbc",
    sid: "sess_2xyz",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  } as never);
});

function pgRow(overrides: Partial<Record<string, unknown>> = {}) {
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

describe("Authentication Middleware Security", () => {
  describe("requireAuthWithMessage", () => {
    it("returns 401 when no __session cookie exists", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns 401 when the __session cookie is blank", async () => {
      sessionCookieValue = "";

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
    });

    it("passes the raw cookie value and CLERK_SECRET_KEY to Clerk verification on success", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow()]);

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
      expect(mockVerifyToken).toHaveBeenCalledWith("signed-clerk-jwt-value", {
        secretKey: "sk_test_clickfolio_secret",
      });
    });

    it("returns user fields mapped from the Postgres row when claims verify", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow({ privacySettings: { showDirectory: true }, role: "senior" })]);

      const result = await requireAuthWithMessage("You must be logged in");

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

  describe("requireAuthWithUserValidation", () => {
    it("returns 401 when no session exists", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
      expect(result.db).toBeNull();
      expect(result.env).toBeNull();
    });

    it("returns 404 when verified claims have no mapped Postgres row", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([]);

      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(404);
      const body = (await result.error?.json()) as { error?: string };
      expect(body.error).toContain("User account not found");
      expect(result.dbUser).toBeNull();
    });

    it("returns db, env, user, and dbUser with clerkId from the verified sub claim", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow()]);

      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
      expect(result.db).toBe(mockDb.db);
      expect(result.env).toBe(env);
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

      await requireAuthWithUserValidation("You must be logged in");

      expect(mockDb.from).toHaveBeenCalledWith(userTable);

      const condition = mockDb.where.mock.calls[0]?.[0];
      expect(condition).toBeDefined();
      const { sql, params } = new PgDialect().sqlToQuery(condition);
      expect(sql).toBe('"user"."clerk_id" = $1');
      expect(params).toEqual(["user_2clerkAbc"]);
    });

    it("rejects tampered cookies instead of falling back to DB data", async () => {
      sessionCookieValue = "tampered-jwt-payload";
      mockVerifyToken.mockRejectedValue(new Error("JWT signature verification failed"));
      mockDb.setRows([pgRow({ email: "attacker@test.com" })]);

      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("Session Expiration Handling", () => {
    it("rejects an expired Clerk session JWT", async () => {
      sessionCookieValue = "expired-clerk-jwt";
      mockVerifyToken.mockRejectedValue(new Error("JWT has expired"));

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("accepts a session whose exp claim is still in the future", async () => {
      sessionCookieValue = "valid-unexpired-clerk-jwt";
      mockVerifyToken.mockResolvedValue({
        sub: "user_2clerkAbc",
        exp: Math.floor(Date.now() / 1000) + 60,
        iat: Math.floor(Date.now() / 1000),
      } as never);
      mockDb.setRows([pgRow()]);

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
    });
  });

  describe("Session Rotation (Clerk sid)", () => {
    it("maps rotated sessions (fresh sid claim after re-login) to the same local row", async () => {
      mockDb.setRows([pgRow()]);

      sessionCookieValue = "jwt-with-session-one";
      mockVerifyToken.mockResolvedValue({
        sub: "user_2clerkAbc",
        sid: "sess_old",
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as never);
      const first = await requireAuthWithMessage("You must be logged in");

      sessionCookieValue = "jwt-with-session-two";
      mockVerifyToken.mockResolvedValue({
        sub: "user_2clerkAbc",
        sid: "sess_new",
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as never);
      const second = await requireAuthWithMessage("You must be logged in");

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(second.user?.id).toBe(first.user?.id);
    });

    it("handles multiple concurrent devices holding distinct sessions", async () => {
      mockDb.setRows([pgRow()]);
      sessionCookieValue = "jwt-from-device-b";
      mockVerifyToken.mockResolvedValue({
        sub: "user_2clerkAbc",
        sid: "sess_device_b",
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as never);

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("legacy-user-1");
    });
  });

  describe("Session Token Format Validation", () => {
    it("rejects non-JWT garbage in the __session cookie", async () => {
      sessionCookieValue = "valid-token-format-12345";
      mockVerifyToken.mockRejectedValue(new Error("Invalid session token format"));

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Authentication Bypass Prevention", () => {
    it("rejects requests carrying only the __client device cookie", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("blocks malformed session tokens", async () => {
      sessionCookieValue = "invalid-token";
      mockVerifyToken.mockRejectedValue(new Error("Invalid token"));

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("blocks requests with no cookies at all", async () => {
      sessionCookieValue = undefined;

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("JWT Signature Validation", () => {
    it("rejects tampered JWT signatures", async () => {
      sessionCookieValue = "jwt-with-modified-payload";
      mockVerifyToken.mockRejectedValue(new Error("Invalid signature"));

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("rejects JWTs signed with an unexpected algorithm", async () => {
      sessionCookieValue = "jwt-with-alg-none";
      mockVerifyToken.mockRejectedValue(new Error("Invalid algorithm"));

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("rejects verified payloads without a sub claim", async () => {
      sessionCookieValue = "unsigned-subjectless-token";
      mockVerifyToken.mockResolvedValue({} as never);

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Fail-Closed Behavior", () => {
    it("fails closed with 401 when Clerk credentials are unconfigured (auth service throws)", async () => {
      delete (env as unknown as Record<string, unknown>).CLERK_SECRET_KEY;
      try {
        sessionCookieValue = "otherwise-valid-jwt";
        mockDb.setRows([pgRow()]);

        const result = await requireAuthWithMessage("You must be logged in");

        expect(result.error?.status).toBe(401);
        expect(result.user).toBeNull();
      } finally {
        env.CLERK_SECRET_KEY = "sk_test_clickfolio_secret";
      }
    });

    it("propagates database failures during row lookup (route handlers map to 500)", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setQueryError(new Error("Database connection lost"));

      await expect(requireAuthWithUserValidation("You must be logged in")).rejects.toThrow(
        "Database connection lost",
      );
    });
  });

  describe("Defense in Depth", () => {
    it("still requires a live local row even when the JWT verifies", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([]);

      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(404);
    });

    it("resolves the row owned by the verified sub, not any other account", async () => {
      sessionCookieValue = "signed-clerk-jwt-value";
      mockDb.setRows([pgRow({ id: "other-user-row" })]);

      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("other-user-row");
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });
  });
});
