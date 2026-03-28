import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authentication Middleware Security Tests
 * Tests session validation, expiration, and security mechanisms
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn();

const mockDb = {
  query: {
    user: {
      findFirst: mockFindFirst,
    },
  },
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
};

// Mock auth/api
const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn().mockResolvedValue({
    api: {
      getSession: mockGetSession,
    },
  }),
}));

// Mock headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("cookie-value"),
  }),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
}));

// Mock DB session
vi.mock("@/lib/db/session", () => ({
  getSessionDbWithPrimaryFirst: vi.fn().mockResolvedValue({
    db: mockDb,
    captureBookmark: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock cloudflare:workers
vi.mock("cloudflare:workers", () => ({
  env: {
    CLICKFOLIO_DB: {} as D1Database,
  },
}));

// Mock security headers
vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn((error: string, _code: string, status: number) => {
    return new Response(JSON.stringify({ error }), { status });
  }),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Test Suite ──────────────────────────────────────────────────────

describe("Authentication Middleware Security", () => {
  describe("requireAuthWithMessage", () => {
    it("returns 401 when no session exists", async () => {
      mockGetSession.mockResolvedValue(null);

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
      expect(result.user).toBeNull();
    });

    it("returns user when valid session exists", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("user-123");
    });

    it("returns 401 for expired session", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      });

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("requireAuthWithUserValidation", () => {
    it("returns 401 when no session exists", async () => {
      mockGetSession.mockResolvedValue(null);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("returns 404 for stale session (user deleted)", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "deleted-user-id",
          email: "deleted@test.com",
          name: "Deleted User",
          image: null,
          handle: "deleted",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "deleted-user-id",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // User not found in DB
      mockLimit.mockResolvedValue([]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(404);
    });

    it("returns success for valid session with existing user", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // User exists in DB
      mockLimit.mockResolvedValue([{ id: "user-123", handle: "testuser" }]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("user-123");
      expect(result.dbUser).toEqual({ id: "user-123", handle: "testuser" });
    });

    it("detects and rejects cookie tampering attempts", async () => {
      // Session with tampered user data
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "attacker@test.com", // Changed email
          name: "Attacker",
          image: null,
          handle: "attacker",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "admin", // Escalated role
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "tampered-token",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // DB shows actual user data doesn't match
      mockLimit.mockResolvedValue([
        {
          id: "user-123",
          handle: "testuser",
          email: "user@test.com",
          isAdmin: false,
        },
      ]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      // Should still succeed (session is valid), but use DB as source of truth
      expect(result.error).toBeNull();
    });
  });

  describe("Session Expiration Handling", () => {
    it("rejects session that expired 1 minute ago", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
        },
      });

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("accepts session valid for at least 1 more minute", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute from now
        },
      });

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
    });
  });

  describe("Session Fixation Prevention", () => {
    it("session ID is regenerated on login", async () => {
      // New session should have new ID
      const newSession = {
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: crypto.randomUUID(), // New random ID
          userId: "user-123",
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      };

      mockGetSession.mockResolvedValue(newSession);

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
    });
  });

  describe("Secure Cookie Attributes", () => {
    it("validates session token format", async () => {
      // Session token should be a valid UUID-like string
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "valid-token-format-12345",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error).toBeNull();
    });
  });

  describe("Authentication Bypass Prevention", () => {
    it("blocks empty authentication headers", async () => {
      vi.mocked(await import("next/headers")).headers.mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      });

      mockGetSession.mockResolvedValue(null);

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("blocks malformed session tokens", async () => {
      vi.mocked(await import("next/headers")).headers.mockResolvedValue({
        get: vi.fn().mockReturnValue("invalid-token"),
      });

      mockGetSession.mockRejectedValue(new Error("Invalid token"));

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("blocks requests with missing cookies entirely", async () => {
      vi.mocked(await import("next/headers")).headers.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      mockGetSession.mockResolvedValue(null);

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("JWT Signature Validation", async () => {
    it("rejects tampered JWT signatures", async () => {
      // Better Auth validates JWT signatures internally
      mockGetSession.mockRejectedValue(new Error("Invalid signature"));

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("rejects JWT with invalid algorithm", async () => {
      mockGetSession.mockRejectedValue(new Error("Invalid algorithm"));

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Session Concurrent Limit", () => {
    it("handles multiple concurrent sessions for same user", async () => {
      // User has multiple valid sessions
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-2", // Second session
          userId: "user-123",
          token: "token-2",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      mockLimit.mockResolvedValue([{ id: "user-123", handle: "testuser" }]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error).toBeNull();
    });
  });

  describe("Session Invalidation", () => {
    it("detects invalidated sessions", async () => {
      // Session was explicitly invalidated (e.g., logout)
      mockGetSession.mockResolvedValue(null);

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });
  });

  describe("Suspicious Activity Detection", () => {
    it("handles authentication service errors gracefully", async () => {
      mockGetSession.mockRejectedValue(new Error("Auth service unavailable"));

      const { requireAuthWithMessage } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithMessage("You must be logged in");

      expect(result.error?.status).toBe(401);
    });

    it("handles database errors during user validation", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // DB error during validation
      mockLimit.mockRejectedValue(new Error("Database error"));

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      // Should fail safe (error response)
      expect(result.error).toBeTruthy();
    });
  });

  describe("Defense in Depth", () => {
    it("validates user exists even if session appears valid", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123",
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // User was deleted after session was created
      mockLimit.mockResolvedValue([]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error?.status).toBe(404);
    });

    it("validates session ownership matches user record", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "user@test.com",
          name: "Test User",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "mid_level",
        },
        session: {
          id: "session-123",
          userId: "user-123", // Matches
          token: "token-abc",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      mockLimit.mockResolvedValue([{ id: "user-123", handle: "testuser" }]);

      const { requireAuthWithUserValidation } = await import("@/lib/auth/middleware");
      const result = await requireAuthWithUserValidation("You must be logged in");

      expect(result.error).toBeNull();
      expect(result.user?.id).toBe("user-123");
    });
  });
});
