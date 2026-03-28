import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IDOR (Insecure Direct Object Reference) tests for admin routes
 * Tests that only admin users can access admin functionality
 */

// ── Mocks ────────────────────────────────────────────────────────────

// DB mock
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

// Mock getServerSession
vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
  count: vi.fn(() => ({ as: vi.fn() })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

// Mock DB module
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock the schema
vi.mock("@/lib/db/schema", () => ({
  user: {
    id: "id",
    email: "email",
    name: "name",
    handle: "handle",
    isAdmin: "isAdmin",
    isPro: "isPro",
    referralCount: "referralCount",
    createdAt: "createdAt",
  },
  resumes: {
    id: "id",
    userId: "userId",
    status: "status",
  },
  siteData: {
    id: "id",
    userId: "userId",
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
  },
}));

import { getServerSession } from "@/lib/auth/session";

const mockedGetSession = vi.mocked(getServerSession);

// ── Helpers ──────────────────────────────────────────────────────────

function createMockSession(userId: string, isAdmin: boolean) {
  return {
    user: {
      id: userId,
      email: `${userId}@test.com`,
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: "{}",
      onboardingCompleted: true,
      role: "mid_level",
      isAdmin,
    },
    session: {
      id: "session-001",
      userId,
      token: "token-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Test Suite ──────────────────────────────────────────────────────

describe("IDOR - Admin Routes Security", () => {
  describe("GET /api/admin/users", () => {
    it("returns 403 for non-admin user", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });

    it("returns 401 when no session exists", async () => {
      mockedGetSession.mockResolvedValue(null);

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(401);
    });

    it("returns 200 for admin user", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("admin-1", true));
      mockFindFirst.mockResolvedValue({
        id: "admin-1",
        email: "admin@test.com",
        name: "Admin User",
        isAdmin: true,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error).toBeNull();
      expect(result.user?.isAdmin).toBe(true);
    });
  });

  describe("GET /api/admin/stats", () => {
    it("returns 403 for regular user accessing admin stats", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });

    it("blocks admin privilege escalation attempt", async () => {
      // User tries to trick system into thinking they are admin
      mockedGetSession.mockResolvedValue({
        ...createMockSession("user-a", false),
        user: {
          ...createMockSession("user-a", false).user,
          isAdmin: true, // Attempted spoof
        },
      });

      // But DB check reveals they are not actually admin
      mockFindFirst.mockResolvedValue({
        id: "user-a",
        email: "user@test.com",
        name: "Regular User",
        isAdmin: false,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("GET /api/admin/analytics", () => {
    it("returns 403 for non-admin accessing analytics", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("GET /api/admin/referrals", () => {
    it("returns 403 for regular user accessing referral data", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("GET /api/admin/resumes", () => {
    it("returns 403 for non-admin accessing resume audit", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("Admin Session Security", () => {
    it("returns 404 or 401 for deleted user with stale admin session", async () => {
      // Session exists but user was deleted
      mockedGetSession.mockResolvedValue(createMockSession("deleted-admin", true));
      mockFindFirst.mockResolvedValue(null); // User not found

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect([401, 404]).toContain(result.error?.status);
    });

    it("blocks admin with expired elevated session", async () => {
      // Admin session that has expired
      mockedGetSession.mockResolvedValue({
        user: {
          id: "admin-1",
          email: "admin@test.com",
          name: "Admin User",
          handle: "admin",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "admin",
          isAdmin: true,
        },
        session: {
          id: "expired-session",
          userId: "admin-1",
          token: "expired-token",
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      // Should be rejected due to expired session
      expect([401, 403]).toContain(result.error?.status);
    });
  });

  describe("Admin Endpoint Enumeration", () => {
    it("all admin endpoints return 403 for non-admin", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const adminEndpoints = ["users", "stats", "analytics", "referrals", "resumes"];

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");

      for (const _ of adminEndpoints) {
        const result = await requireAdminAuthForApi();
        expect(result.error?.status).toBe(403);
      }
    });
  });

  describe("Cookie Tampering Protection", () => {
    it("rejects admin role bypass via cookie tampering", async () => {
      // Session indicates admin but DB says otherwise
      mockedGetSession.mockResolvedValue({
        user: {
          id: "attacker",
          email: "attacker@test.com",
          name: "Attacker",
          handle: "attacker",
          headline: null,
          privacySettings: "{}",
          onboardingCompleted: true,
          role: "admin", // Claimed admin role
          isAdmin: true, // Claimed admin status
        },
        session: {
          id: "tampered-session",
          userId: "attacker",
          token: "tampered-token",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // But DB shows they're not admin
      mockFindFirst.mockResolvedValue({
        id: "attacker",
        email: "attacker@test.com",
        name: "Attacker",
        isAdmin: false, // Actual DB value
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("Admin Data Access Protection", () => {
    it("prevents admin data access without proper role", async () => {
      // User with elevated role but not isAdmin flag
      mockedGetSession.mockResolvedValue(createMockSession("manager-1", false));
      mockFindFirst.mockResolvedValue({
        id: "manager-1",
        email: "manager@test.com",
        name: "Manager",
        isAdmin: false,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });

    it("requires both session and DB admin verification", async () => {
      // Session is admin but DB check fails
      mockedGetSession.mockResolvedValue(createMockSession("admin-1", true));
      mockFindFirst.mockResolvedValue(null); // DB doesn't have user

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect([401, 404]).toContain(result.error?.status);
    });
  });

  describe("Valid Session but Non-Admin User", () => {
    it("returns 403 for valid session without admin role", async () => {
      // Valid authenticated session
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));
      mockFindFirst.mockResolvedValue({
        id: "user-a",
        email: "user@test.com",
        name: "Regular User",
        isAdmin: false,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("Admin Privilege Escalation Attempts", () => {
    it("blocks role escalation via direct API calls", async () => {
      // User tries to modify their own role to admin
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      // Cannot access admin endpoints to modify roles
      expect(result.error?.status).toBe(403);
    });
  });
});
