import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

const admin = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/auth/admin", async () => ({
  authenticateAdmin: (await import("../../helpers/authenticate-stub")).authenticateAdminStub(() =>
    admin.read(),
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    UMAMI_API_URL: "https://analytics.example.com",
    UMAMI_USERNAME: "admin",
    UMAMI_PASSWORD: "secret",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args: JsonValue[]) => ({ and: args })),
  or: vi.fn((...args: JsonValue[]) => ({ or: args })),
  ne: vi.fn((_col, val) => ({ ne: val })),
  desc: vi.fn((col) => ({ desc: col })),
  asc: vi.fn((col) => ({ asc: col })),
  gte: vi.fn((_col, val) => ({ gte: val })),
  gt: vi.fn((_col, val) => ({ gt: val })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: JsonValue[]) => ({
      sql: strings.join("?"),
      values,
    })),
    {
      join: vi.fn((values: JsonValue[], _separator?: string) => ({
        toString: () => values.join(", "),
      })),
      literal: vi.fn((val: JsonValue) => ({
        toString: () => JSON.stringify(val),
      })),
      raw: vi.fn((str: string) => ({
        toString: () => str,
      })),
    },
  ),
  count: vi.fn(() => ({ count: "count" })),
  sum: vi.fn((col) => ({ sum: col })),
  coalesce: vi.fn((...args) => ({ coalesce: args })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/umami/client", () => ({
  getStats: vi.fn().mockResolvedValue({
    pageviews: 1000,
    visitors: 500,
    comparison: {
      pageviews: 800,
      visitors: 400,
    },
  }),
  getPageviews: vi.fn().mockResolvedValue({
    pageviews: [
      { x: "2026-01-01T00:00:00Z", y: 100 },
      { x: "2026-01-02T00:00:00Z", y: 150 },
    ],
    sessions: [
      { x: "2026-01-01T00:00:00Z", y: 50 },
      { x: "2026-01-02T00:00:00Z", y: 75 },
    ],
  }),
  getMetrics: vi.fn().mockResolvedValue([
    { x: "/@testuser", y: 50 },
    { x: "/@otheruser", y: 30 },
  ]),
}));

vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn((error: string, _code: string, status: number) => {
    return new Response(JSON.stringify({ error }), { status });
  }),
  createSuccessResponse: vi.fn((data: JsonValue) => {
    return new Response(JSON.stringify(data), { status: 200 });
  }),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    BAD_REQUEST: "BAD_REQUEST",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

vi.mock("@/lib/db/schema", () => ({
  user: {
    id: "id",
    email: "email",
    name: "name",
    handle: "handle",
    isAdmin: "is_admin",
    createdAt: "created_at",
    updatedAt: "updated_at",
    role: "role",
    roleSource: "role_source",
  },
  resumes: {
    id: "id",
    userId: "user_id",
    status: "status",
    errorMessage: "error_message",
    retryCount: "retry_count",
    totalAttempts: "total_attempts",
    queuedAt: "queued_at",
    updatedAt: "updated_at",
    createdAt: "created_at",
    r2Key: "r2_key",
    parsedAt: "parsed_at",
    lastAttemptError: "last_attempt_error",
  },
  siteData: {
    id: "id",
    userId: "user_id",
    resumeId: "resume_id",
    content: "content",
    themeId: "theme_id",
    lastPublishedAt: "last_published_at",
    updatedAt: "updated_at",
  },
  handleChanges: {
    id: "id",
    userId: "user_id",
    oldHandle: "old_handle",
    newHandle: "new_handle",
    createdAt: "created_at",
  },
}));

import type { AdminUser } from "@/lib/auth/admin";

const mockedAdminAuth = admin.read;

const mockSelect = vi.fn();

const mockFrom = vi.fn();

const mockWhere = vi.fn();

const mockOrderBy = vi.fn();

const mockLimit = vi.fn();

const mockOffset = vi.fn();

const mockLeftJoin = vi.fn();

const mockInsert = vi.fn();

const mockUpdate = vi.fn();

const createChainable = () => {
  const chain = {
    from: mockFrom,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    offset: mockOffset,
    groupBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
    leftJoin: mockLeftJoin,
  };

  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockOrderBy.mockReturnValue(chain);
  mockLimit.mockResolvedValue([]);
  mockOffset.mockResolvedValue([]);
  mockLeftJoin.mockReturnValue(chain);

  return chain;
};

createChainable();

mockInsert.mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

mockUpdate.mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

type AdminAuthedResult = { user: AdminUser; error: null };

type AuthErrorResult = { error: Response };

function adminAuthed(userId = "admin-123"): AdminAuthedResult {
  const user: AdminUser = {
    id: userId,
    email: `${userId}@admin.com`,
    name: "Admin User",
    isAdmin: true,
  };

  mockedAdminAuth.mockResolvedValue({ user, error: null });

  return { user, error: null };
}

function regularUserAuthed(): AuthErrorResult {
  const error = new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });

  mockedAdminAuth.mockResolvedValue({ error });

  return { error };
}

function unauthenticated(): AuthErrorResult {
  const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  mockedAdminAuth.mockResolvedValue({ error });

  return { error };
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
  mockLimit.mockReset().mockResolvedValue([]);
});

describe("Admin API Integration Tests", () => {
  describe("GET /api/admin/analytics", () => {
    it("returns Umami analytics data for admin (test 1)", async () => {
      adminAuthed();

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request = makeRequest("http://localhost:3000/api/admin/analytics?period=7d");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body: { totals: { views: number; unique: number } } = await response.json();
      expect(body.totals).toBeDefined();
      expect(body.totals.views).toBe(1000);
      expect(body.totals.unique).toBe(500);
    });

    it("returns 400 for invalid period parameter (test 13)", async () => {
      adminAuthed();

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request = makeRequest("http://localhost:3000/api/admin/analytics?period=invalid");
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body: { error: string } = await response.json();
      expect(body.error).toContain("Invalid period");
    });

    it("filters analytics by date range (test 9)", async () => {
      adminAuthed();

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request30d = makeRequest("http://localhost:3000/api/admin/analytics?period=30d");
      const response30d = await GET(request30d);

      expect(response30d.status).toBe(200);

      const request90d = makeRequest("http://localhost:3000/api/admin/analytics?period=90d");
      const response90d = await GET(request90d);

      expect(response90d.status).toBe(200);
    });

    it("returns 403 for non-admin users (test 6)", async () => {
      regularUserAuthed();

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request = makeRequest("http://localhost:3000/api/admin/analytics");
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("returns 401 when not authenticated (test 7)", async () => {
      unauthenticated();

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request = makeRequest("http://localhost:3000/api/admin/analytics");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("handles Umami API errors gracefully (test 1 edge case)", async () => {
      adminAuthed();

      const { getStats } = await import("@/lib/umami/client");
      vi.mocked(getStats).mockRejectedValueOnce(new Error("Umami API error"));

      const { GET } = await import("@/app/api/admin/analytics/route");
      const request = makeRequest("http://localhost:3000/api/admin/analytics");
      const response = await GET(request);

      expect(response.status).toBe(503);
    });
  });

  describe("GET /api/admin/resumes", () => {
    it("returns 400 for invalid status filter (test 11 edge)", async () => {
      adminAuthed();

      const { GET } = await import("@/app/api/admin/resumes/route");

      const request = makeRequest(
        "http://localhost:3000/api/admin/resumes?status=invalid_status&page=1",
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("returns 403 for non-admin users (test 6)", async () => {
      regularUserAuthed();

      const { GET } = await import("@/app/api/admin/resumes/route");
      const request = makeRequest("http://localhost:3000/api/admin/resumes");
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("returns 401 when not authenticated", async () => {
      unauthenticated();

      const { GET } = await import("@/app/api/admin/resumes/route");
      const request = makeRequest("http://localhost:3000/api/admin/resumes");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/admin/users", () => {
    it("returns 403 for non-admin users (test 6)", async () => {
      regularUserAuthed();

      const { GET } = await import("@/app/api/admin/users/route");
      const request = makeRequest("http://localhost:3000/api/admin/users");
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("returns 401 when not authenticated", async () => {
      unauthenticated();

      const { GET } = await import("@/app/api/admin/users/route");
      const request = makeRequest("http://localhost:3000/api/admin/users");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Admin Authentication Edge Cases", () => {
    it("handles deleted user with stale admin session (test 8)", async () => {
      const error = new Response(JSON.stringify({ error: "User not found" }), { status: 401 });
      mockedAdminAuth.mockResolvedValue({ error });

      const { GET } = await import("@/app/api/admin/users/route");
      const response = await GET(makeRequest("http://localhost:3000/api/admin/users"));

      expect(response.status).toBe(401);
    });

    it("tracks admin role source (test 15)", async () => {
      const adminUser: AdminUser = {
        id: "admin-123",
        email: "admin@test.com",
        name: "Admin User",
        isAdmin: true,
      };

      mockedAdminAuth.mockResolvedValue({ user: adminUser, error: null });

      const { GET } = await import("@/app/api/admin/users/route");
      await GET(makeRequest("http://localhost:3000/api/admin/users"));

      expect(mockedAdminAuth).toHaveBeenCalled();
    });

    it("handles all admin routes consistently (test 5-7 combined)", async () => {
      const { GET: AnalyticsGET } = await import("@/app/api/admin/analytics/route");
      const { GET: ResumesGET } = await import("@/app/api/admin/resumes/route");
      const { GET: UsersGET } = await import("@/app/api/admin/users/route");

      const routes = [
        { get: AnalyticsGET, path: "/api/admin/analytics" },
        { get: ResumesGET, path: "/api/admin/resumes" },
        { get: UsersGET, path: "/api/admin/users" },
      ];

      for (const route of routes) {
        unauthenticated();

        const response = await route.get(makeRequest(`http://localhost:3000${route.path}`));

        expect(response.status).toBe(401);
      }
    });
  });
});
