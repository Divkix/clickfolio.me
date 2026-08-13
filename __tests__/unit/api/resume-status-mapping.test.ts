/**
 * Resume status mapping regression tests.
 *
 * Both GET /api/resume/status and GET /api/resume/latest-status must surface
 * pre-processing statuses (pending_claim / queued / waiting_for_cache) as
 * "processing":
 *  - latest-status feeds the wizard's initializeWizard() duplicate-upload
 *    guard (an in-flight parse must redirect to /waiting, not fall through to
 *    the upload step).
 *  - status feeds /waiting's useResumeStatus hook, which treats any
 *    non-"processing" status as terminal and stops polling (pending_claim
 *    previously stalled the page forever).
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);

const mockFindFirst = vi.fn();
const mockDb = {
  query: { resumes: { findFirst: mockFindFirst } },
};

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn(() => "and"),
  desc: vi.fn(() => "desc"),
}));

vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    userId: "userId",
    status: "status",
    errorMessage: "errorMessage",
    retryCount: "retryCount",
    totalAttempts: "totalAttempts",
    lastAttemptError: "lastAttemptError",
    createdAt: "createdAt",
    parsedContent: "parsedContent",
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

function authedAs(userId: string, db: JsonValue) {
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
    db: db as never,
    captureBookmark: mockCaptureBookmark,
    dbUser: { id: userId, handle: "testuser" },
    env: { DB: {} } as never,
    error: null,
  });
}

function latestResumeRow(status: string) {
  return [
    {
      id: "resume-001",
      userId: "user-1",
      status,
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      // Recent timestamp so waiting_for_cache is not considered timed-out by
      // lifecycle.waitingForCacheTimedOut (10m threshold). The timeout case
      // is covered separately in resume-status-waiting-cache.test.ts.
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Hand-rolled select chain for the latest-status route's
 * `.select().from().where().orderBy().limit(1)` shape. Returns a real promise
 * at `.limit()` so awaiting the chain actually settles (the shared
 * createMockQueryChain helper's `then` never calls its resolve callback).
 */
function selectChainResolving(rows: JsonValue[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockReset();
});

// ── GET /api/resume/latest-status ─────────────────────────────────────

describe("GET /api/resume/latest-status — status mapping", () => {
  it.each(["pending_claim", "queued", "waiting_for_cache"])(
    "maps %s to processing so the wizard detects the in-flight parse",
    async (dbStatus) => {
      const db = selectChainResolving(latestResumeRow(dbStatus));
      authedAs("user-1", db as unknown as JsonValue);

      const { GET } = await import("@/app/api/resume/latest-status/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; id: string };
      expect(body.status).toBe("processing");
      expect(body.id).toBe("resume-001");
    },
  );

  it("leaves completed untouched", async () => {
    const db = selectChainResolving(latestResumeRow("completed"));
    authedAs("user-1", db as unknown as JsonValue);

    const { GET } = await import("@/app/api/resume/latest-status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("completed");
  });

  it("leaves failed untouched (so /waiting still shows the retry UI)", async () => {
    const db = selectChainResolving(latestResumeRow("failed"));
    authedAs("user-1", db as unknown as JsonValue);

    const { GET } = await import("@/app/api/resume/latest-status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("failed");
  });

  it("returns null when the user has no resumes", async () => {
    const db = selectChainResolving([]);
    authedAs("user-1", db as unknown as JsonValue);

    const { GET } = await import("@/app/api/resume/latest-status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as unknown;
    expect(body).toBeNull();
  });
});

// ── GET /api/resume/status ────────────────────────────────────────────

describe("GET /api/resume/status — pending_claim mapping", () => {
  function makeStatusRequest(resumeId: string) {
    return new Request(`http://localhost:3000/api/resume/status?resume_id=${resumeId}`);
  }

  it("maps pending_claim to processing so /waiting keeps polling", async () => {
    authedAs("user-1", mockDb as unknown as JsonValue);
    mockFindFirst.mockResolvedValue({
      id: "resume-001",
      userId: "user-1",
      status: "pending_claim",
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(makeStatusRequest("resume-001"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      progress_pct: number;
      can_retry: boolean;
      error: string | null;
    };
    expect(body.status).toBe("processing");
    expect(body.progress_pct).toBe(15);
    expect(body.can_retry).toBe(false);
    expect(body.error).toBeNull();
  });

  it("keeps queued surfaced as processing with 25% progress", async () => {
    authedAs("user-1", mockDb as unknown as JsonValue);
    mockFindFirst.mockResolvedValue({
      id: "resume-001",
      userId: "user-1",
      status: "queued",
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(makeStatusRequest("resume-001"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      progress_pct: number;
      queued: boolean;
    };
    expect(body.status).toBe("processing");
    expect(body.progress_pct).toBe(25);
    expect(body.queued).toBe(true);
  });

  it("keeps processing surfaced as processing with 50% progress", async () => {
    authedAs("user-1", mockDb as unknown as JsonValue);
    mockFindFirst.mockResolvedValue({
      id: "resume-001",
      userId: "user-1",
      status: "processing",
      errorMessage: null,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
      createdAt: new Date().toISOString(),
    });

    const { GET } = await import("@/app/api/resume/status/route");
    const response = await GET(makeStatusRequest("resume-001"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; progress_pct: number };
    expect(body.status).toBe("processing");
    expect(body.progress_pct).toBe(50);
  });
});
