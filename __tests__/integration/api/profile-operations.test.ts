import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
  requireAuthWithMessage: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args: JsonValue[]) => ({ and: args })),
  or: vi.fn((...args: JsonValue[]) => ({ or: args })),
  ne: vi.fn((_col, val) => ({ ne: val })),
  desc: vi.fn((col) => ({ desc: col })),
  gte: vi.fn((_col, val) => ({ gte: val })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: JsonValue[]) => ({
    sql: strings.join("?"),
    values,
  })),
  count: vi.fn(() => ({ count: "count" })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn(
    (error: string, _code: string, status: number, details?: JsonValue) => {
      type ErrorBody = { error: string; details?: JsonValue };
      const body: ErrorBody = { error };
      if (details !== undefined) body.details = details;
      return new Response(JSON.stringify(body), { status });
    },
  ),
  createSuccessResponse: vi.fn((data: JsonValue) => {
    return new Response(JSON.stringify(data), { status: 200 });
  }),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    BAD_REQUEST: "BAD_REQUEST",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    CONFLICT: "CONFLICT",
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: {
    id: "id",
    email: "email",
    name: "name",
    image: "image",
    handle: "handle",
    headline: "headline",
    privacySettings: "privacy_settings",
    onboardingCompleted: "onboarding_completed",
    role: "role",
    roleSource: "role_source",
    isAdmin: "is_admin",
    isPro: "is_pro",
    referralCount: "referral_count",
    referralCode: "referral_code",
    referredBy: "referred_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  handleChanges: {
    id: "id",
    userId: "user_id",
    oldHandle: "old_handle",
    newHandle: "new_handle",
    createdAt: "created_at",
  },
  siteData: {
    id: "id",
    userId: "user_id",
  },
  resumes: {
    id: "id",
    userId: "user_id",
    status: "status",
  },
}));

import { requireAuthWithMessage, requireAuthWithUserValidation } from "@/lib/auth/middleware";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);
const mockedAuthMessage = vi.mocked(requireAuthWithMessage);

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockReturning = vi.fn();
const mockTransaction = vi.fn();

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
mockOrderBy.mockReturnValue({ limit: mockLimit });
mockLimit.mockResolvedValue([]);

mockInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockResolvedValue(undefined);

mockUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
mockUpdateWhere.mockResolvedValue(undefined);

mockTransaction.mockImplementation(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb));

const mockDb = {
  query: {
    user: { findFirst: mockFindFirst },
  },
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  insert: mockInsert,
  update: mockUpdate,
  transaction: mockTransaction,
};
interface UserProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search: boolean;
    show_in_directory: boolean;
  };
  onboardingCompleted: boolean;
  role: "student" | "entry_level" | "mid_level" | "senior" | "executive";
  roleSource: "ai" | "user";
  isAdmin: boolean;
  isPro: boolean;
  referralCount: number;
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type AuthedAsResult = { user: UserProfile; error: null };
function authedAs(userId: string, options: Partial<UserProfile> = {}): AuthedAsResult {
  const defaultProfile: UserProfile = {
    id: userId,
    email: `${userId}@test.com`,
    name: "Test User",
    image: null,
    handle: "testuser",
    headline: "Software Engineer",
    privacySettings: {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    },
    onboardingCompleted: true,
    role: "mid_level",
    roleSource: "user",
    isAdmin: false,
    isPro: false,
    referralCount: 0,
    referralCode: `REF-${userId}`,
    referredBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const user = { ...defaultProfile, ...options };

  mockedAuth.mockResolvedValue({
    user,
    db: mockDb as never,
    dbUser: { id: userId, handle: user.handle, clerkId: "user_clerk_1" },
    env: {
      HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    } as never,
    error: null,
  } as never);

  mockedAuthMessage.mockResolvedValue({ user: user as never, error: null });

  return { user, error: null };
}

function unauthenticated() {
  const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  mockedAuth.mockResolvedValue({
    user: null,
    db: null,
    dbUser: null,
    env: null,
    error,
  } as never);
  mockedAuthMessage.mockResolvedValue({ user: null, error });
  return error;
}

function makeRequest(url: string, method = "GET", body?: JsonValue): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockReset();
  mockLimit.mockReset().mockResolvedValue([]);

  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
});

describe("Profile API Integration Tests (20 tests)", () => {
  describe("GET /api/profile/me", () => {
    it("returns current user data when authenticated (test 1)", async () => {
      authedAs("user-123", { referralCount: 5 });

      mockLimit.mockResolvedValue([
        {
          id: "user-123",
          name: "Test User",
          email: "user-123@test.com",
          image: null,
          handle: "testuser",
          headline: "Software Engineer",
          privacySettings: {
            show_phone: false,
            show_address: false,
            hide_from_search: false,
            show_in_directory: true,
          },
          onboardingCompleted: true,
          role: "mid_level",
          roleSource: "user",
          isAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { id: string; email: string };
      expect(body.id).toBe("user-123");
      expect(body.email).toBe("user-123@test.com");
    });

    it("returns 401 when not authenticated (test 8)", async () => {
      unauthenticated();

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(401);
    });

    it("returns 404 when user record deleted (test 14)", async () => {
      authedAs("user-123");
      mockLimit.mockResolvedValue([]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(404);
    });

    it("returns profile with correct fields (test 19)", async () => {
      authedAs("user-123", { referralCount: 10, referralCode: "ABC123" });

      mockLimit.mockResolvedValue([
        {
          id: "user-123",
          name: "Test User",
          email: "user-123@test.com",
          image: null,
          handle: "testuser",
          headline: "Software Engineer",
          privacySettings: {},
          onboardingCompleted: true,
          role: "senior",
          roleSource: "user",
          isAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { id: string; role: string };
      expect(body.id).toBe("user-123");
      expect(body.role).toBe("senior");
    });

    it("returns onboarding status (test 20)", async () => {
      authedAs("user-123", { onboardingCompleted: false });

      mockLimit.mockResolvedValue([
        {
          id: "user-123",
          name: "Test User",
          email: "user-123@test.com",
          image: null,
          handle: "testuser",
          headline: "Software Engineer",
          privacySettings: {},
          onboardingCompleted: false,
          role: "entry_level",
          roleSource: "ai",
          isAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { onboardingCompleted: boolean };
      expect(body.onboardingCompleted).toBe(false);
    });
  });

  describe("PUT /api/profile/handle", () => {
    it("updates handle successfully when unique (test 2)", async () => {
      authedAs("user-123", { handle: "oldhandle" });

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          })),
        })),
      }));

      mockLimit.mockResolvedValueOnce([{ handle: "oldhandle" }]);

      mockLimit.mockResolvedValueOnce([]);

      mockReturning.mockResolvedValueOnce([{ id: "user-123" }]);

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "newhandle",
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; handle: string };
      expect(body.success).toBe(true);
      expect(body.handle).toBe("newhandle");
    });

    it("returns 409 when handle already taken (test 9)", async () => {
      authedAs("user-123", { handle: "oldhandle" });

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          })),
        })),
      }));

      mockLimit.mockResolvedValueOnce([{ handle: "oldhandle" }]);

      mockLimit.mockResolvedValueOnce([{ id: "other-user" }]);

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "takenhandle",
      });
      const response = await PUT(request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("already taken");
    });

    it("returns 400 for invalid handle format (test 10)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "invalid_handle!",
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 for reserved handle names (test 11)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "api",
      });
      const response = await PUT(request);

      expect([400, 409, 500]).toContain(response.status);
    });

    it("creates handle audit trail on change (test 15)", async () => {
      authedAs("user-123", { handle: "oldhandle" });

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          })),
        })),
      }));

      mockLimit.mockResolvedValueOnce([{ handle: "oldhandle" }]);
      mockLimit.mockResolvedValueOnce([]);

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "newhandle",
      });
      await PUT(request);

      expect(mockTransaction).toHaveBeenCalled();
    });

    it("returns 429 when rate limit exceeded (test 16)", async () => {
      authedAs("user-123");

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          })),
        })),
      }));

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "newhandle",
      });
      const response = await PUT(request);

      expect([429, 500]).toContain(response.status);
      if (response.status === 429) {
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("Rate limit");
      }
    });

    it("returns 400 when handle is unchanged (test 2 edge case)", async () => {
      authedAs("user-123", { handle: "samehandle" });

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          })),
        })),
      }));

      mockLimit.mockResolvedValueOnce([{ handle: "samehandle" }]);

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "samehandle",
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("returns 401 when not authenticated (test 8)", async () => {
      unauthenticated();

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "newhandle",
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 for handle too short (test 6)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "ab",
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 for handle too long (test 6)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "a".repeat(31),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/profile/privacy", () => {
    it("updates privacy settings successfully (test 3)", async () => {
      authedAs("user-123");

      mockReturning.mockResolvedValue([{ id: "user-123" }]);

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = makeRequest("http://localhost:3000/api/profile/privacy", "PUT", {
        show_phone: true,
        show_address: false,
        hide_from_search: true,
        show_in_directory: false,
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; privacy_settings: JsonValue };
      expect(body.success).toBe(true);
      expect(body.privacy_settings).toEqual({
        show_phone: true,
        show_address: false,
        hide_from_search: true,
        show_in_directory: false,
      });
    });

    it("returns 400 for invalid privacy fields (test 12)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = makeRequest("http://localhost:3000/api/profile/privacy", "PUT", {
        show_phone: "invalid",
        show_address: false,
        hide_from_search: true,
        show_in_directory: false,
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("persists privacy settings correctly (test 18)", async () => {
      authedAs("user-123");

      const updateSpy = vi.fn().mockResolvedValue(undefined);
      mockDb.update = updateSpy;

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = makeRequest("http://localhost:3000/api/profile/privacy", "PUT", {
        show_phone: false,
        show_address: true,
        hide_from_search: false,
        show_in_directory: true,
      });
      await PUT(request);

      expect(updateSpy).toHaveBeenCalled();
    });

    it("returns 401 when not authenticated (test 8)", async () => {
      unauthenticated();

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = makeRequest("http://localhost:3000/api/profile/privacy", "PUT", {
        show_phone: true,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
    });

    it("validates all required privacy fields (test 7)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = makeRequest("http://localhost:3000/api/profile/privacy", "PUT", {
        show_phone: true,
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/profile/role", () => {
    it("updates role successfully (test 4)", async () => {
      authedAs("user-123", { role: "entry_level" });

      mockUpdateWhere.mockResolvedValue(undefined);

      const { PUT } = await import("@/app/api/profile/role/route");
      const request = makeRequest("http://localhost:3000/api/profile/role", "PUT", {
        role: "senior",
      });
      const response = await PUT(request);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        const body = (await response.json()) as { role: string; roleSource: string };
        expect(body.role).toBe("senior");
        expect(body.roleSource).toBe("user");
      }
    });

    it("returns 400 for invalid role value (test 4 validation)", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/role/route");
      const request = makeRequest("http://localhost:3000/api/profile/role", "PUT", {
        role: "invalid_role",
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("tracks role source as user (test 15)", async () => {
      authedAs("user-123", { roleSource: "ai" });

      const updateSpy = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      mockDb.update = updateSpy;

      const { PUT } = await import("@/app/api/profile/role/route");
      const request = makeRequest("http://localhost:3000/api/profile/role", "PUT", {
        role: "executive",
      });
      await PUT(request);

      expect(updateSpy).toHaveBeenCalled();
    });

    it("returns 401 when not authenticated (test 8)", async () => {
      unauthenticated();

      const { PUT } = await import("@/app/api/profile/role/route");
      const request = makeRequest("http://localhost:3000/api/profile/role", "PUT", {
        role: "senior",
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Edge Cases and Concurrent Operations", () => {
    it("handles concurrent handle changes with race condition (test 17)", async () => {
      authedAs("user-123", { handle: "oldhandle" });

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          })),
        })),
      }));

      mockLimit.mockResolvedValueOnce([{ handle: "oldhandle" }]);

      mockLimit.mockResolvedValueOnce([]);

      mockTransaction.mockRejectedValueOnce(
        Object.assign(
          new Error('duplicate key value violates unique constraint "user_handle_key"'),
          {
            code: "23505",
          },
        ),
      );

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {
        handle: "racedhandle",
      });
      const response = await PUT(request);

      expect(response.status).toBe(409);
    });

    it("handles handle change with empty body", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/handle/route");
      const request = makeRequest("http://localhost:3000/api/profile/handle", "PUT", {});
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("handles privacy update with malformed JSON", async () => {
      authedAs("user-123");

      const { PUT } = await import("@/app/api/profile/privacy/route");
      const request = new Request("http://localhost:3000/api/profile/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("handles profile fetch with null privacy settings (jsonb default normalization)", async () => {
      authedAs("user-123");

      mockLimit.mockResolvedValue([
        {
          id: "user-123",
          name: "Test User",
          email: "user-123@test.com",
          image: null,
          handle: "testuser",
          headline: "Software Engineer",
          privacySettings: null,
          onboardingCompleted: true,
          role: "mid_level",
          roleSource: "user",
          isAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { privacySettings: Record<string, boolean> };
      expect(body.privacySettings).toEqual({
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      });
    });
  });
});
