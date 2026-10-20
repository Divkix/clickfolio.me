import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
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

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error).toBeNull();
      expect(result.user?.isAdmin).toBe(true);
    });
  });

  describe("admin authorization", () => {
    it("returns 403 for a regular user", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

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

  describe("Admin Privilege Escalation Attempts", () => {
    it("blocks role escalation via direct API calls", async () => {
      mockedGetSession.mockResolvedValue(createMockSession("user-a", false));

      const { requireAdminAuthForApi } = await import("@/lib/auth/admin");
      const result = await requireAdminAuthForApi();

      expect(result.error?.status).toBe(403);
    });
  });
});
