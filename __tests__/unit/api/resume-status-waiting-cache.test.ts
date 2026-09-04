import { WAITING_FOR_CACHE_TIMEOUT_MS } from "@/lib/resume/lifecycle";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

const mockFindFirst = vi.fn();
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDb = {
  query: { resumes: { findFirst: mockFindFirst } },
  update: mockDbUpdate,
};

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn(() => "and"),
  desc: vi.fn(() => "desc"),
  gte: vi.fn(() => "gte"),
  ne: vi.fn(() => "ne"),
  isNotNull: vi.fn(() => "isNotNull"),
}));

vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    userId: "userId",
    status: "status",
    errorMessage: "errorMessage",
    retryCount: "retryCount",
    totalAttempts: "totalAttempts",
    createdAt: "createdAt",
    parsedContent: "parsedContent",
    fileHash: "fileHash",
  },
  siteData: {
    id: "id",
    userId: "userId",
    resumeId: "resumeId",
    content: "content",
    themeId: "themeId",
    lastPublishedAt: "lastPublishedAt",
    updatedAt: "updatedAt",
  },
  user: {
    id: "id",
    referralCount: "referralCount",
    isPro: "isPro",
  },
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
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

function authedAs(userId: string) {
  mockedAuth.mockResolvedValue({
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
    },
    db: mockDb as never,
    dbUser: { id: userId, handle: "testuser", clerkId: `clerk_${userId}` },
    env: {
      HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    } as never,
    error: null,
  });
}

function makeStatusRequest(resumeId: string) {
  return new Request(`http://localhost:3000/api/resume/status?resume_id=${resumeId}`);
}

function makeResume(overrides: {
  id?: string;
  userId?: string;
  status?: string;
  errorMessage?: string | null;
  retryCount?: number;
  totalAttempts?: number;
  createdAt?: string | null;
}) {
  const createdAt = "createdAt" in overrides ? overrides.createdAt : new Date().toISOString();

  return {
    id: overrides.id ?? "resume-001",
    userId: overrides.userId ?? "user-1",
    status: overrides.status ?? "processing",
    errorMessage: overrides.errorMessage ?? null,
    retryCount: overrides.retryCount ?? 0,
    totalAttempts: overrides.totalAttempts ?? 1,
    createdAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
});

describe("GET /api/resume/status — waiting_for_cache timeout", () => {
  describe("Within timeout window (< 10 minutes)", () => {
    it("returns processing with waiting_for_cache flag when status is waiting_for_cache and recently created", async () => {
      authedAs("user-1");

      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "waiting_for_cache",
          createdAt: recentTime,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        progress_pct: number;
        waiting_for_cache: boolean;
        can_retry: boolean;
        error: string | null;
      };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);
      expect(body.can_retry).toBe(false);
      expect(body.progress_pct).toBe(30);
    });

    it("returns processing with waiting_for_cache for freshly created resume", async () => {
      authedAs("user-1");

      const now = new Date().toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "waiting_for_cache",
          createdAt: now,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { waiting_for_cache: boolean; status: string };
      expect(body.waiting_for_cache).toBe(true);
      expect(body.status).toBe("processing");
    });
  });

  describe("Past timeout window (> 10 minutes)", () => {
    it("transitions to failed when waiting_for_cache has been stuck for over 10 minutes", async () => {
      authedAs("user-1");

      const staleTime = new Date(
        Date.now() - (WAITING_FOR_CACHE_TIMEOUT_MS + 60_000),
      ).toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          id: "resume-001",
          status: "waiting_for_cache",
          createdAt: staleTime,
          retryCount: 0,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        progress_pct: number;
        error: string;
        can_retry: boolean;
      };
      expect(body.status).toBe("failed");
      expect(body.error).toContain("timed out");
      expect(body.can_retry).toBe(true);
      expect(body.progress_pct).toBe(0);
    });

    it("sets can_retry to false when retry count is exhausted", async () => {
      authedAs("user-1");

      const staleTime = new Date(Date.now() - WAITING_FOR_CACHE_TIMEOUT_MS * 2).toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          id: "resume-001",
          status: "waiting_for_cache",
          createdAt: staleTime,
          retryCount: 2,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { can_retry: boolean };
      expect(body.can_retry).toBe(false);
    });

    it("presents stale waiting_for_cache as failed WITHOUT writing to the DB (side-effect-free GET)", async () => {
      authedAs("user-1");

      const staleTime = new Date(Date.now() - WAITING_FOR_CACHE_TIMEOUT_MS - 5000).toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          id: "resume-001",
          status: "waiting_for_cache",
          createdAt: staleTime,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; error: string };
      expect(body.status).toBe("failed");
      expect(mockDbUpdateSet).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("handles createdAt as an invalid date string gracefully", async () => {
      authedAs("user-1");

      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "waiting_for_cache",
          createdAt: "not-a-valid-date",
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; waiting_for_cache?: boolean };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);
    });

    it("handles createdAt as null/undefined", async () => {
      authedAs("user-1");

      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "waiting_for_cache",
          createdAt: null,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");

      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("failed");
    });

    it("handles createdAt as empty string", async () => {
      authedAs("user-1");

      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "waiting_for_cache",
          createdAt: "",
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; waiting_for_cache?: boolean };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);
    });

    it("does NOT timeout for non-waiting_for_cache statuses with stale createdAt", async () => {
      authedAs("user-1");

      const staleTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockFindFirst.mockResolvedValue(
        makeResume({
          status: "queued",
          createdAt: staleTime,
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; queued?: boolean };
      expect(body.status).toBe("processing");
      expect(body.queued).toBe(true);
    });
  });
});
