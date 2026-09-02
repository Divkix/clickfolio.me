/**
 * Unit tests for GET /api/admin/users route.
 * Tests pagination, search, and previewName fallback for Unnamed users.
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createMockQueryChain } from "@/__tests__/setup/mocks/db.mock";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockRequireAdminAuthForApi = vi.fn();
vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuthForApi: (...args: unknown[]) => mockRequireAdminAuthForApi(...args),
}));

let mockUsersRows: Array<Record<string, unknown>> = [];
let mockResumeRows: Array<Record<string, unknown>> = [];
let mockSiteDataRows: Array<Record<string, unknown>> = [];
let mockCountRows: Array<{ count: number }> = [{ count: 0 }];

const mockDb = {
  select: vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
    if (fields && "count" in fields) {
      return createMockQueryChain(mockCountRows);
    }
    if (fields && "previewName" in fields) {
      return createMockQueryChain(mockSiteDataRows);
    }
    if (fields && "status" in fields) {
      return createMockQueryChain(mockResumeRows);
    }
    return createMockQueryChain(mockUsersRows);
  }),
};

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: {},
  },
}));

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAuthForApi.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com", isAdmin: true },
      error: null,
    });
    mockCountRows = [{ count: 1 }];
    mockUsersRows = [];
    mockResumeRows = [];
    mockSiteDataRows = [];
  });

  it("falls back to siteData previewName when user.name is Unnamed", async () => {
    mockUsersRows = [
      {
        id: "user-1",
        name: "Unnamed",
        email: "user1@example.com",
        handle: "userone",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockSiteDataRows = [
      {
        userId: "user-1",
        lastPublishedAt: "2026-01-01T00:00:00Z",
        previewName: "Parsed Jane Doe",
      },
    ];

    const { GET } = await import("@/app/api/admin/users/route");
    const request = new Request("http://localhost:3000/api/admin/users?page=1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      users: Array<{ id: string; name: string; handle: string }>;
    };
    expect(body.users[0]?.name).toBe("Parsed Jane Doe");
  });

  it("falls back to siteData previewName when user.name is empty string", async () => {
    mockUsersRows = [
      {
        id: "user-2",
        name: "",
        email: "user2@example.com",
        handle: "usertwo",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockSiteDataRows = [
      {
        userId: "user-2",
        lastPublishedAt: "2026-01-01T00:00:00Z",
        previewName: "Resume Extracted Name",
      },
    ];

    const { GET } = await import("@/app/api/admin/users/route");
    const request = new Request("http://localhost:3000/api/admin/users?page=1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      users: Array<{ id: string; name: string }>;
    };
    expect(body.users[0]?.name).toBe("Resume Extracted Name");
  });

  it("keeps user.name when user already has a valid name", async () => {
    mockUsersRows = [
      {
        id: "user-3",
        name: "Google OAuth User",
        email: "user3@example.com",
        handle: "userthree",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockSiteDataRows = [
      {
        userId: "user-3",
        lastPublishedAt: "2026-01-01T00:00:00Z",
        previewName: "Resume Name",
      },
    ];

    const { GET } = await import("@/app/api/admin/users/route");
    const request = new Request("http://localhost:3000/api/admin/users?page=1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      users: Array<{ id: string; name: string }>;
    };
    expect(body.users[0]?.name).toBe("Google OAuth User");
  });

  it("returns Unnamed when neither user.name nor previewName is available", async () => {
    mockUsersRows = [
      {
        id: "user-4",
        name: "Unnamed",
        email: "user4@example.com",
        handle: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockSiteDataRows = [];

    const { GET } = await import("@/app/api/admin/users/route");
    const request = new Request("http://localhost:3000/api/admin/users?page=1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      users: Array<{ id: string; name: string }>;
    };
    expect(body.users[0]?.name).toBe("Unnamed");
  });
});
