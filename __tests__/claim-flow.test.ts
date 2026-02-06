import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Claim flow tests for POST /api/resume/claim.
 *
 * Tests the claim-check pattern: anonymous upload → auth → claim → queue parse.
 * Mocks auth, R2, rate limit, DB, and queue to isolate claim logic.
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);

const mockFindFirst = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();
const mockDbOrderBy = vi.fn();
const mockDbInsertValues = vi.fn().mockResolvedValue(undefined);
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockDbBatch = vi.fn().mockResolvedValue(undefined);

// Chain helpers for select().from().where().orderBy().limit()
mockDbSelect.mockReturnValue({ from: mockDbFrom });
mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ orderBy: mockDbOrderBy, limit: mockDbLimit });
mockDbOrderBy.mockReturnValue({ limit: mockDbLimit });
mockDbLimit.mockResolvedValue([]);

// Chain for update().set().where()
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });
mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });

const mockDb = {
  query: { resumes: { findFirst: mockFindFirst } },
  select: mockDbSelect,
  from: mockDbFrom,
  where: mockDbWhere,
  limit: mockDbLimit,
  insert: mockDbInsert,
  update: mockDbUpdate,
  batch: mockDbBatch,
};

// Auth mock
vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

// Drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  gte: vi.fn((_col, val) => ({ gte: val })),
  ne: vi.fn((_col, val) => ({ ne: val })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
}));

// Schema mock
vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    userId: "userId",
    r2Key: "r2Key",
    status: "status",
    errorMessage: "errorMessage",
    retryCount: "retryCount",
    totalAttempts: "totalAttempts",
    createdAt: "createdAt",
    fileHash: "fileHash",
    parsedContent: "parsedContent",
    queuedAt: "queuedAt",
    parsedAt: "parsedAt",
  },
  siteData: {
    id: "id",
    userId: "userId",
    resumeId: "resumeId",
    content: "content",
    lastPublishedAt: "lastPublishedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

// R2 mock
const mockR2GetAsArrayBuffer = vi.fn();
const mockR2Put = vi.fn().mockResolvedValue(undefined);
const mockR2Delete = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn(() => ({})),
  R2: {
    getAsArrayBuffer: (...args: unknown[]) => mockR2GetAsArrayBuffer(...args),
    put: (...args: unknown[]) => mockR2Put(...args),
    delete: (...args: unknown[]) => mockR2Delete(...args),
  },
}));

// Rate limit mock
vi.mock("@/lib/utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

// Validation mock
vi.mock("@/lib/utils/validation", () => ({
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_FILE_SIZE_LABEL: "5MB",
  validateRequestSize: vi.fn(() => ({ valid: true })),
}));

// Queue mock
vi.mock("@/lib/queue/resume-parse", () => ({
  publishResumeParse: vi.fn().mockResolvedValue(undefined),
}));

// Referral mock
vi.mock("@/lib/referral", () => ({
  writeReferral: vi.fn().mockResolvedValue({ success: false, reason: "no referral" }),
}));

// buildSiteDataUpsert mock
vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: vi.fn().mockReturnValue("mock-upsert-query"),
}));

// Security headers (keep real logic for response format)
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
import { validateRequestSize } from "@/lib/utils/validation";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);
const mockedValidateRequestSize = vi.mocked(validateRequestSize);

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a valid PDF buffer (starts with %PDF- magic bytes) */
function makePdfBuffer(): ArrayBuffer {
  const header = new TextEncoder().encode("%PDF-1.4 fake content");
  return header.buffer.slice(header.byteOffset, header.byteOffset + header.byteLength);
}

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

function makeClaimRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/resume/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations that tests may override
  mockedValidateRequestSize.mockReturnValue({ valid: true });
  // Default: R2 returns a valid PDF buffer
  mockR2GetAsArrayBuffer.mockResolvedValue(makePdfBuffer());
  // Default: no cached or processing resumes
  mockDbLimit.mockResolvedValue([]);
  // Re-wire DB chain mocks (clearAllMocks resets call history but not implementations,
  // however some chain mocks need re-setup after per-test overrides)
  mockDbSelect.mockReturnValue({ from: mockDbFrom });
  mockDbFrom.mockReturnValue({ where: mockDbWhere });
  mockDbWhere.mockReturnValue({ orderBy: mockDbOrderBy, limit: mockDbLimit });
  mockDbOrderBy.mockReturnValue({ limit: mockDbLimit });
  mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
  mockDbInsertValues.mockResolvedValue(undefined);
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });
  mockDbUpdateWhere.mockResolvedValue(undefined);
});

// ── Tests ────────────────────────────────────────────────────────────

describe("POST /api/resume/claim", () => {
  it("returns 401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue({
      user: null,
      db: null,
      captureBookmark: null,
      dbUser: null,
      env: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when key is missing", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({}));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Invalid upload key");
  });

  it("returns 400 when key does not start with temp/", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "users/hack/resume.pdf" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("temporary upload");
  });

  it("returns 413 when request size validation fails", async () => {
    authedAs("user-1");
    mockedValidateRequestSize.mockReturnValue({ valid: false, error: "Request body too large" });

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }));

    expect(response.status).toBe(413);
  });

  it("returns 404 when file not found in R2 and no recent resume exists", async () => {
    authedAs("user-1");
    mockR2GetAsArrayBuffer.mockResolvedValue(null);
    // No recent resume found for double-claim check
    mockDbLimit.mockResolvedValue([]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }));

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("not found");
  });

  it("returns already_claimed when file gone but recent resume exists (double-claim guard)", async () => {
    authedAs("user-1");
    mockR2GetAsArrayBuffer.mockResolvedValue(null);
    // Recent resume found
    mockDbLimit.mockResolvedValue([{ id: "existing-resume", status: "processing" }]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { already_claimed: boolean; resume_id: string };
    expect(body.already_claimed).toBe(true);
    expect(body.resume_id).toBe("existing-resume");
  });

  it("queues a new resume for parsing on valid claim", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { resume_id: string; status: string };
    expect(body.status).toBe("queued");
    expect(body.resume_id).toBeDefined();

    // Verify R2 put was called (file stored to user's folder)
    expect(mockR2Put).toHaveBeenCalled();
    // Verify DB insert was called (resume record created)
    expect(mockDbInsert).toHaveBeenCalled();
  });
});
