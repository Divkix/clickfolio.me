import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type ClaimHeaders = { "Content-Type": string; Cookie?: string };

/**
 * Tests the claim-check pattern: anonymous upload → auth → claim → queue parse.
 * Mocks auth, R2, rate limit, DB, and queue to isolate claim logic.
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();
const mockDbOrderBy = vi.fn();
const mockDbInsertValues = vi.fn().mockResolvedValue(undefined);
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockDbTransaction = vi.fn(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb));

let mockHandleRows: Array<{ handle: string | null }> = [{ handle: "test-handle" }];

const mockDbSelect = vi.fn().mockImplementation((cols: unknown) => {
  const isHandleQuery =
    cols !== null && typeof cols === "object" && "handle" in (cols as Record<string, unknown>);
  if (isHandleQuery) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockHandleRows),
        }),
      }),
    };
  }
  return { from: mockDbFrom };
});

// Chain helpers for non-handle selects: select().from().where().orderBy().limit()
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
  transaction: mockDbTransaction,
};

// Auth mock
vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

// Drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args: JsonValue[]) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  gte: vi.fn((_col, val) => ({ gte: val })),
  ne: vi.fn((_col, val) => ({ ne: val })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
  inArray: vi.fn((col, values) => ({ inArray: { col, values } })),
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
  user: {
    id: "id",
    handle: "handle",
  },
}));

// R2 mock
const mockR2GetAsArrayBuffer = vi.fn();
const mockR2Put = vi.fn().mockResolvedValue(undefined);
const mockR2Delete = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn(() => ({})),
  R2: {
    getAsArrayBuffer: (...args: JsonValue[]) => mockR2GetAsArrayBuffer(...args),
    put: (...args: JsonValue[]) => mockR2Put(...args),
    delete: (...args: JsonValue[]) => mockR2Delete(...args),
  },
}));

// Rate limit mock
vi.mock("@/lib/rate-limit/user", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

// Validation mock
vi.mock("@/lib/utils/validation", () => ({
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_FILE_SIZE_LABEL: "5MB",
  validateRequestSize: vi.fn(() => ({ valid: true })),
  readJsonWithLimit: vi.fn(async (req: Request) => {
    try {
      return { ok: true, data: await req.json() };
    } catch {
      return { ok: false, reason: "invalid_json", error: "Invalid JSON in request body" };
    }
  }),
}));

// Queue mock
vi.mock("@/lib/queue/resume-parse", () => ({
  publishResumeParse: vi.fn().mockResolvedValue(undefined),
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
      privacySettings: {
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      },
      onboardingCompleted: true,
      role: "mid_level",
    },
    db: mockDb as never,
    dbUser: { id: userId, handle: "testuser", clerkId: "user_clerk_1" },
    env: { CLICKFOLIO_PARSE_QUEUE: {}, PENDING_UPLOAD_SECRET: TEST_SECRET } as never,
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

const TEST_SECRET = "test-secret-key-for-testing-only";

function makeClaimRequest(body: UnknownRecord, cookieValue?: string) {
  const headers: ClaimHeaders = {
    "Content-Type": "application/json",
  };
  if (cookieValue) headers.Cookie = `pending_upload=${cookieValue}`;

  return new Request("http://localhost:3000/api/resume/claim", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user has handle so publish=true unless test overrides mockHandleRows
  mockHandleRows = [{ handle: "test-handle" }];
  // Reset mock implementations that tests may override
  mockedValidateRequestSize.mockReturnValue({ valid: true });
  // Default: R2 returns a valid PDF buffer
  mockR2GetAsArrayBuffer.mockResolvedValue(makePdfBuffer());
  // Default: no cached or processing resumes
  mockDbLimit.mockResolvedValue([]);
  // Re-wire DB chain mocks — use handle-aware select that bypasses positional callCount
  mockDbSelect.mockImplementation((cols: unknown) => {
    const isHandleQuery =
      cols !== null && typeof cols === "object" && "handle" in (cols as Record<string, unknown>);
    if (isHandleQuery) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockHandleRows),
          }),
        }),
      };
    }
    return { from: mockDbFrom };
  });
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
      dbUser: null,
      env: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(401);
  });

  it("returns 400 when key is missing", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/missing-key/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({}, cookie));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Invalid upload key");
  });

  it("returns 400 when key does not start with temp/", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    // Cookie must match body key even for validation errors
    const cookie = await createSignedCookieValue("users/hack/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "users/hack/resume.pdf" }, cookie));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("temporary upload");
  });

  it("returns 413 when request size validation fails", async () => {
    authedAs("user-1");
    mockedValidateRequestSize.mockReturnValue({ valid: false, error: "Request body too large" });

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(413);
  });

  it("returns 404 when file not found in R2 and no recent resume exists", async () => {
    authedAs("user-1");
    mockR2GetAsArrayBuffer.mockResolvedValue(null);
    // No recent resume found for double-claim check
    mockDbLimit.mockResolvedValue([]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

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
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { already_claimed: boolean; resume_id: string };
    expect(body.already_claimed).toBe(true);
    expect(body.resume_id).toBe("existing-resume");
  });

  it("returns already_claimed when R2 throws missing-object error and recent resume exists", async () => {
    authedAs("user-1");
    mockR2GetAsArrayBuffer.mockRejectedValue(new Error("No such key"));
    mockDbLimit.mockResolvedValue([{ id: "existing-resume", status: "processing" }]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { already_claimed: boolean; resume_id: string };
    expect(body.already_claimed).toBe(true);
    expect(body.resume_id).toBe("existing-resume");
  });

  it("returns 500 on transient R2 fetch errors even if a recent resume exists", async () => {
    authedAs("user-1");
    mockR2GetAsArrayBuffer.mockRejectedValue(new Error("R2 timeout"));
    mockDbLimit.mockResolvedValue([{ id: "existing-resume", status: "processing" }]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(500);
  });

  it("queues a new resume for parsing on valid claim", async () => {
    authedAs("user-1");

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { resume_id: string; status: string };
    expect(body.status).toBe("queued");
    expect(body.resume_id).toBeDefined();

    // Verify R2 put was called (file stored to user's folder)
    expect(mockR2Put).toHaveBeenCalled();
    // Verify DB insert was called (resume record created)
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("leaves resume in pending_claim (orphan-cron recoverable) when queue publish fails", async () => {
    authedAs("user-1");
    const { publishResumeParse } = await import("@/lib/queue/resume-parse");
    vi.mocked(publishResumeParse).mockRejectedValueOnce(new Error("Queue unavailable"));

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(500);
    // Regression (Batch A item 8): the row must be rolled back to pending_claim —
    // marking it "failed" would make it unrecoverable by the */15 orphan cron.
    expect(mockDbUpdateSet).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_claim" }),
    );
  });

  it("returns already_claimed BEFORE rate limiting (double-claim does not burn a rate-limit slot)", async () => {
    authedAs("user-1");
    const { enforceRateLimit } = await import("@/lib/rate-limit/user");
    vi.mocked(enforceRateLimit).mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
    );
    // File gone (already claimed) but a recent resume exists → double-claim guard.
    mockR2GetAsArrayBuffer.mockResolvedValue(null);
    mockDbLimit.mockResolvedValue([{ id: "existing-resume", status: "processing" }]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { already_claimed: boolean };
    expect(body.already_claimed).toBe(true);
    // The rate limiter must not have been consulted for the double-claim path.
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it("still enforces the rate limit after the double-claim guard for real claims", async () => {
    authedAs("user-1");
    const { enforceRateLimit } = await import("@/lib/rate-limit/user");
    vi.mocked(enforceRateLimit).mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
    );
    mockDbLimit.mockResolvedValue([]);

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalled();
  });

  it("uses publish:false when cached resume exists but user has no handle", async () => {
    authedAs("user-1");
    // Ensure rate limiter allows this request (previous test may have set it to 429)
    const { enforceRateLimit } = await import("@/lib/rate-limit/user");
    vi.mocked(enforceRateLimit).mockResolvedValue(null);

    // Cache hit → parsedContent comes back as a parsed jsonb OBJECT from Postgres;
    // handle missing → publish:false
    const cachedContent = { full_name: "Test User" };
    mockDbLimit.mockResolvedValue([{ id: "cached-resume", parsedContent: cachedContent }]);
    mockHandleRows = [];

    const { POST } = await import("@/app/api/resume/claim/route");
    const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
    const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; cached?: boolean };
    expect(body.status).toBe("completed");
    expect(body.cached).toBe(true);

    const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");
    expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
      expect.anything(), // tx (transaction-scoped)
      "user-1",
      expect.anything(), // resumeId
      cachedContent,
      { publish: false },
    );
    // Resume completion + siteData upsert committed atomically in one PG transaction
    expect(mockDbTransaction).toHaveBeenCalled();
  });
});
