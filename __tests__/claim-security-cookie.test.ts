import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security tests for POST /api/resume/claim cookie verification.
 *
 * Tests the fix for issue #89: Claim route must verify temp key ownership
 * via signed cookie to prevent unauthorized claims of leaked temp keys.
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

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

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
      role: "mid_level",
    },
    db: mockDb as never,
    captureBookmark: mockCaptureBookmark,
    dbUser: { id: userId, handle: "testuser" },
    env: {
      DB: {},
      CLICKFOLIO_PARSE_QUEUE: {},
      BETTER_AUTH_SECRET: "test-secret-key-for-testing-only",
    } as never,
    error: null,
  });
}

/**
 * Create a signed cookie value for the pending upload cookie.
 * Format: {temp_key}|{expires_timestamp}|{hmac_signature}
 */
async function createSignedCookieValue(
  tempKey: string,
  secret: string,
  expiresAt?: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const actualExpiresAt = expiresAt ?? Date.now() + 30 * 60 * 1000; // 30 min default
  const payload = `${tempKey}|${actualExpiresAt}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${payload}|${signatureBase64}`;
}

function makeClaimRequest(body: Record<string, unknown>, cookieValue?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookieValue) {
    // Cookie values should not be URL-encoded in the Cookie header
    // The browser sends them as-is, and the server parses them as-is
    headers["Cookie"] = `pending_upload=${cookieValue}`;
  }

  return new Request("http://localhost:3000/api/resume/claim", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: R2 returns a valid PDF buffer
  mockR2GetAsArrayBuffer.mockResolvedValue(makePdfBuffer());
  // Default: no cached or processing resumes
  mockDbLimit.mockResolvedValue([]);
  // Re-wire DB chain mocks
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

// ── Security Tests ────────────────────────────────────────────────────

describe("POST /api/resume/claim - Cookie Security (Issue #89)", () => {
  const TEST_SECRET = "test-secret-key-for-testing-only";
  const VALID_TEMP_KEY = "temp/uuid-123/resume.pdf";

  it("returns 403 when pending_upload cookie is missing", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Unauthorized upload attempt");
  });

  it("returns 403 when pending_upload cookie has invalid signature", async () => {
    authedAs("user-1");

    const invalidCookie = `${VALID_TEMP_KEY}|${Date.now() + 30 * 60 * 1000}|invalid-signature`;

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, invalidCookie));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Unauthorized upload attempt");
  });

  it("returns 403 when pending_upload cookie has expired", async () => {
    authedAs("user-1");

    const expiredTimestamp = Date.now() - 1000; // 1 second ago
    const expiredCookie = await createSignedCookieValue(
      VALID_TEMP_KEY,
      TEST_SECRET,
      expiredTimestamp,
    );

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, expiredCookie));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Unauthorized upload attempt");
  });

  it("returns 403 when pending_upload cookie key does not match body key", async () => {
    authedAs("user-1");

    // Cookie contains a different temp key than the request body
    const cookieKey = "temp/uuid-456/other.pdf";
    const mismatchedCookie = await createSignedCookieValue(cookieKey, TEST_SECRET);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, mismatchedCookie));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Unauthorized upload attempt");
  });

  it("returns 403 when pending_upload cookie is malformed", async () => {
    authedAs("user-1");

    const malformedCookie = "not-a-valid-cookie-format";

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, malformedCookie));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Unauthorized upload attempt");
  });

  it("returns 200 and queues resume when cookie is valid and matches body key", async () => {
    authedAs("user-1");

    const validCookie = await createSignedCookieValue(VALID_TEMP_KEY, TEST_SECRET);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, validCookie));

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
