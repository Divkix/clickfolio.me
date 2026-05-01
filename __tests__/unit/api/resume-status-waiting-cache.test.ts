/**
 * Resume status route — waiting_for_cache timeout tests.
 *
 * Tests the timeout state machine in GET /api/resume/status:
 * - waiting_for_cache within 10 min → returns "processing" with waiting_for_cache: true
 * - waiting_for_cache past 10 min → transitions to "failed"
 * - Edge cases: invalid/missing createdAt
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Constants from source ─────────────────────────────────────────────

const WAITING_FOR_CACHE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ── Mocks ─────────────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);

const mockFindFirst = vi.fn();
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDb = {
  query: { resumes: { findFirst: mockFindFirst } },
  update: mockDbUpdate,
};

// Auth mock
vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

// Drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn(() => "and"),
  desc: vi.fn(() => "desc"),
  gte: vi.fn(() => "gte"),
  ne: vi.fn(() => "ne"),
  isNotNull: vi.fn(() => "isNotNull"),
}));

// Schema mock
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

// Security headers
vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn((error: string, _code: string, status: number) => {
    return new Response(JSON.stringify({ error }), { status });
  }),
  createSuccessResponse: vi.fn((data: unknown) => {
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

// ── Helpers ───────────────────────────────────────────────────────────

function authedAs(userId: string) {
  mockedAuth.mockResolvedValue({
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
    },
    db: mockDb as never,
    captureBookmark: mockCaptureBookmark,
    dbUser: { id: userId, handle: "testuser" },
    env: { DB: {} } as never,
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
  // Only default createdAt when key is absent — not when explicitly passed as null
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
  // Reset mock chain
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("GET /api/resume/status — waiting_for_cache timeout", () => {
  describe("Within timeout window (< 10 minutes)", () => {
    it("returns processing with waiting_for_cache flag when status is waiting_for_cache and recently created", async () => {
      authedAs("user-1");

      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
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
      ).toISOString(); // 11 minutes ago
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
      expect(body.can_retry).toBe(true); // retryCount 0 < 2
      expect(body.progress_pct).toBe(0);
    });

    it("sets can_retry to false when retry count is exhausted", async () => {
      authedAs("user-1");

      const staleTime = new Date(Date.now() - WAITING_FOR_CACHE_TIMEOUT_MS * 2).toISOString(); // 20 minutes ago
      mockFindFirst.mockResolvedValue(
        makeResume({
          id: "resume-001",
          status: "waiting_for_cache",
          createdAt: staleTime,
          retryCount: 2, // Exhausted
        }),
      );

      const { GET } = await import("@/app/api/resume/status/route");
      const response = await GET(makeStatusRequest("resume-001"));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { can_retry: boolean };
      expect(body.can_retry).toBe(false);
    });

    it("updates the resume status to failed in the database", async () => {
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
      await GET(makeStatusRequest("resume-001"));

      // Verify DB was updated to failed status
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("timed out"),
        }),
      );
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

      // new Date("not-a-valid-date") returns Invalid Date
      // Date.now() - Invalid Date.getTime() = NaN
      // NaN > WAITING_FOR_CACHE_TIMEOUT_MS is false
      // So it falls through to the "still within timeout" branch
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

      // new Date(null) returns epoch (1970-01-01), which is well past 10 min
      // So it should transition to failed
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

      // new Date("") returns Invalid Date
      // Date.now() - Invalid Date.getTime() = NaN
      // NaN > timeout → false → falls through to processing
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; waiting_for_cache?: boolean };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);
    });

    it("does NOT timeout for non-waiting_for_cache statuses with stale createdAt", async () => {
      authedAs("user-1");

      const staleTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
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
      // queued status is reported as "processing" with queued flag, NOT failed
      expect(body.status).toBe("processing");
      expect(body.queued).toBe(true);
    });
  });
});
