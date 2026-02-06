import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IDOR ownership tests for /api/resume/status and /api/resume/retry.
 *
 * These tests verify that one user cannot access another user's resumes.
 * We mock the auth middleware and DB layer to isolate ownership logic.
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);

// DB mock: findFirst returns are configured per-test
const mockFindFirst = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "resume-1" }]),
    }),
  }),
});
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockDb = {
  query: {
    resumes: {
      findFirst: mockFindFirst,
    },
  },
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  insert: mockInsert,
};

// Mock requireAuthWithUserValidation
vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

// Mock drizzle-orm eq
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
}));

// Mock the schema
vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    userId: "userId",
    status: "status",
    errorMessage: "errorMessage",
    retryCount: "retryCount",
    totalAttempts: "totalAttempts",
    createdAt: "createdAt",
    r2Key: "r2Key",
    lastAttemptError: "lastAttemptError",
    fileHash: "fileHash",
    parsedContent: "parsedContent",
    queuedAt: "queuedAt",
  },
}));

// Mock queue publisher
vi.mock("@/lib/queue/resume-parse", () => ({
  publishResumeParse: vi.fn().mockResolvedValue(undefined),
}));

// Mock R2
vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn(() => ({})),
  R2: {
    getAsUint8Array: vi.fn(),
    getAsArrayBuffer: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock retry config
vi.mock("@/lib/config/retry", () => ({
  hasExceededMaxAttempts: vi.fn(() => false),
  isPermanentErrorType: vi.fn(() => false),
  RETRY_LIMITS: { MANUAL_MAX_RETRIES: 2, TOTAL_MAX_ATTEMPTS: 5 },
}));

// Mock security headers
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
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  },
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

// ── Helpers ──────────────────────────────────────────────────────────

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
      role: "mid_level_professional",
    },
    db: mockDb as never,
    captureBookmark: mockCaptureBookmark,
    dbUser: { id: userId, handle: "testuser" },
    env: { DB: {}, RESUME_PARSE_QUEUE: {} } as never,
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Status endpoint IDOR tests ───────────────────────────────────────

describe("GET /api/resume/status — ownership checks", () => {
  it("returns 403 when user tries to access another user's resume", async () => {
    // User A is authenticated
    authedAs("user-a");

    // Resume belongs to User B
    mockFindFirst.mockResolvedValue({
      id: "resume-1",
      userId: "user-b",
      status: "processing",
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("@/app/api/resume/status/route");
    const request = new Request("http://localhost:3000/api/resume/status?resume_id=resume-1");
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("permission");
  });

  it("returns 200 when user accesses their own resume", async () => {
    authedAs("user-a");

    mockFindFirst.mockResolvedValue({
      id: "resume-1",
      userId: "user-a",
      status: "processing",
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("@/app/api/resume/status/route");
    const request = new Request("http://localhost:3000/api/resume/status?resume_id=resume-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

// ── Retry endpoint IDOR tests ────────────────────────────────────────

describe("POST /api/resume/retry — ownership checks", () => {
  it("returns 403 when user tries to retry another user's resume", async () => {
    authedAs("user-a");

    mockFindFirst.mockResolvedValue({
      id: "resume-1",
      userId: "user-b",
      r2Key: "users/user-b/123/resume.pdf",
      status: "failed",
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      fileHash: "abc123",
    });

    const { POST } = await import("@/app/api/resume/retry/route");
    const request = new Request("http://localhost:3000/api/resume/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_id: "resume-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("permission");
  });

  it("returns 200 when user retries their own failed resume", async () => {
    authedAs("user-a");

    mockFindFirst.mockResolvedValue({
      id: "resume-1",
      userId: "user-a",
      r2Key: "users/user-a/123/resume.pdf",
      status: "failed",
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      fileHash: "abc123",
    });

    const { POST } = await import("@/app/api/resume/retry/route");
    const request = new Request("http://localhost:3000/api/resume/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_id: "resume-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});
