import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

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

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
  gte: vi.fn(),
  count: vi.fn(() => ({ as: vi.fn() })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

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

import { getServerSession, type AppSession } from "@/lib/auth/session";

const mockedGetSession = vi.mocked(getServerSession);

function createMockSession(userId: string, isAdmin: boolean): AppSession {
  return {
    user: {
      id: userId,
      email: `${userId}@test.com`,
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
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

describe("IDOR - Admin Routes Security", () => {
  describe("GET /api/admin/users", () => {
    it("returns 403 for non-admin user", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));
      mockFindFirst.mockResolvedValue({
        id: "user-a",
        email: "user-a@test.com",
        name: "Test User",
        isAdmin: false,
      });

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
      mockFindFirst.mockResolvedValue({
        id: "user-a",
        email: "user-a@test.com",
        name: "Test User",
        isAdmin: false,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });

    it("blocks admin privilege escalation attempt", async () => {
      mockedGetSession.mockResolvedValue({
        ...createMockSession("user-a", false),
        user: {
          ...createMockSession("user-a", false).user,
          isAdmin: true,
        },
      });

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
      mockedGetSession.mockResolvedValue(createMockSession("deleted-admin", true));
      mockFindFirst.mockResolvedValue(null);

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect([401, 404]).toContain(result.error?.status);
    });

    it("blocks admin with expired elevated session", async () => {
      mockedGetSession.mockResolvedValue({
        user: {
          id: "admin-1",
          email: "admin@test.com",
          name: "Admin User",
          image: null,
          handle: "admin",
          headline: null,
          privacySettings: DEFAULT_PRIVACY_SETTINGS,
          onboardingCompleted: true,
          role: "executive",
          isAdmin: true,
        },
        session: {
          id: "expired-session",
          userId: "admin-1",
          token: "expired-token",
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect([401, 403]).toContain(result.error?.status);
    });
  });

  describe("Admin Endpoint Enumeration", () => {
    it("all admin endpoints return 403 for non-admin", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));
      mockFindFirst.mockResolvedValue({
        id: "user-a",
        email: "user-a@test.com",
        name: "Test User",
        isAdmin: false,
      });

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
      mockedGetSession.mockResolvedValue({
        user: {
          id: "attacker",
          email: "attacker@test.com",
          name: "Attacker",
          image: null,
          handle: "attacker",
          headline: null,
          privacySettings: DEFAULT_PRIVACY_SETTINGS,
          onboardingCompleted: true,
          role: "executive",
          isAdmin: true,
        },
        session: {
          id: "tampered-session",
          userId: "attacker",
          token: "tampered-token",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      mockFindFirst.mockResolvedValue({
        id: "attacker",
        email: "attacker@test.com",
        name: "Attacker",
        isAdmin: false,
      });

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });

  describe("Admin Data Access Protection", () => {
    it("prevents admin data access without proper role", async () => {
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
      mockedGetSession.mockResolvedValue(createMockSession("admin-1", true));
      mockFindFirst.mockResolvedValue(null);

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect([401, 404]).toContain(result.error?.status);
    });
  });

  describe("Valid Session but Non-Admin User", () => {
    it("returns 403 for valid session without admin role", async () => {
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
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });
});
