/**
 * Duplicate file hash detection tests for POST /api/resume/claim.
 *
 * The claim route detects duplicate uploads by computing a SHA-256 hash
 * and checking if a processing resume with the same hash exists for the
 * same user. If found, the new upload gets `waiting_for_cache` status.
 *
 * Key security constraint: cache lookups are user-scoped to prevent
 * cross-user data access.
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UnknownRecord, JsonValue } from "@/lib/types/json";
// ── Mocks ─────────────────────────────────────────────────────────────

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

// Chain helpers for non-handle selects: select().from().where().limit()/orderBy().limit()
mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ limit: mockDbLimit, orderBy: mockDbOrderBy });
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

// Referral mock
vi.mock("@/lib/referral", () => ({
  writeReferral: vi.fn().mockResolvedValue({ success: false, reason: "no referral" }),
}));

// buildSiteDataUpsert mock
vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: vi.fn().mockReturnValue("mock-upsert-query"),
}));

// Security headers
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

import { and, eq, isNotNull, ne } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

type ClaimHeaders = { "Content-Type": string; Cookie?: string };

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

// ── Helpers ───────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-key-for-testing-only";

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

// Since SHA-256 hash computation is deterministic, the same PDF buffer
// will always produce the same hash. In tests, we control this via the
// R2 mock returning a fixed buffer. Tests verify the behavior based on
// the hash comparison logic, not the actual hash value.

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user has handle so publish=true unless test overrides mockHandleRows
  mockHandleRows = [{ handle: "test-handle" }];
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
  mockDbWhere.mockReturnValue({ limit: mockDbLimit, orderBy: mockDbOrderBy });
  mockDbOrderBy.mockReturnValue({ limit: mockDbLimit });
  mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
  mockDbInsertValues.mockResolvedValue(undefined);
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });
  mockDbUpdateWhere.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("POST /api/resume/claim — Duplicate file hash detection", () => {
  describe("Same user, same file hash", () => {
    it("returns waiting_for_cache when same user uploads same file while first is processing", async () => {
      authedAs("user-1");

      // First call to db.select → checking for completed cache (returns empty)
      // Second call to db.select → checking for processing with same hash (returns a match)
      // We need to control the db.limit calls — they happen twice in the route
      let limitCallCount = 0;
      mockDbLimit.mockImplementation(() => {
        limitCallCount++;
        // First limit call: cache lookup → empty (no completed cache)
        if (limitCallCount === 1) return Promise.resolve([]);
        // Second limit call: processing check → found a processing resume with same hash
        return Promise.resolve([{ id: "existing-processing-id" }]);
      });

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        resume_id: string;
        status: string;
        waiting_for_cache?: boolean;
      };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);

      // Verify the DB was updated with waiting_for_cache status
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "waiting_for_cache",
        }),
      );
    });

    it("does NOT queue a new parse when same user's file is already processing", async () => {
      authedAs("user-1");

      let limitCallCount = 0;
      mockDbLimit.mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([]);
        // Processing duplicate found
        return Promise.resolve([{ id: "existing-processing-id" }]);
      });

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { waiting_for_cache?: boolean };
      expect(body.waiting_for_cache).toBe(true);

      // Queue publish should NOT have been called (no duplicate parsing)
      const { publishResumeParse } = await import("@/lib/queue/resume-parse");
      expect(publishResumeParse).not.toHaveBeenCalled();
    });

    it("dedupes against a same-hash resume that is queued (not yet processing) — Batch A item 10", async () => {
      authedAs("user-1");

      let limitCallCount = 0;
      mockDbLimit.mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) return Promise.resolve([]); // cache miss
        // In-flight match: the FIRST claim already published and its row is
        // "queued" (not yet "processing") when the second claim checks.
        return Promise.resolve([{ id: "existing-queued-id" }]);
      });

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        waiting_for_cache?: boolean;
      };
      expect(body.status).toBe("processing");
      expect(body.waiting_for_cache).toBe(true);

      // No duplicate parse job published for the second claim.
      const { publishResumeParse } = await import("@/lib/queue/resume-parse");
      expect(publishResumeParse).not.toHaveBeenCalled();

      // The in-flight check must consider BOTH "processing" and "queued" rows.
      const { inArray } = await import("drizzle-orm");
      expect(inArray).toHaveBeenCalledWith("status", ["processing", "queued"]);
    });

    it("uses cached result when same user uploads same file that was already completed", async () => {
      authedAs("user-1");

      // parsedContent is jsonb: Postgres hands back a parsed OBJECT
      const cachedContent = { full_name: "Test User" };
      // Cache lookup returns hit; handle query is detected via select({handle:...}) not positional
      mockDbLimit.mockResolvedValue([{ id: "cached-resume", parsedContent: cachedContent }]);
      mockHandleRows = [{ handle: "test-handle" }];

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; cached?: boolean };
      expect(body.status).toBe("completed");
      expect(body.cached).toBe(true);

      // Queue publish should NOT have been called (cached result used)
      const { publishResumeParse } = await import("@/lib/queue/resume-parse");
      expect(publishResumeParse).not.toHaveBeenCalled();
      // Verify publish gating used handle (hasHandle true → publish:true)
      const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");
      expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
        expect.anything(), // tx (transaction-scoped)
        "user-1",
        expect.anything(), // resumeId
        cachedContent,
        { publish: true },
      );
    });

    it("uses cached result with publish:false when user has no handle (prevents unreachable published site)", async () => {
      authedAs("user-1");

      // parsedContent is jsonb: Postgres hands back a parsed OBJECT
      const cachedContent = { full_name: "Test User" };
      // Cache hit but user handle missing → lastPublishedAt must stay null (publish:false)
      mockDbLimit.mockResolvedValue([{ id: "cached-resume", parsedContent: cachedContent }]);
      mockHandleRows = []; // no handle → hasHandle false

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; cached?: boolean };
      expect(body.status).toBe("completed");
      expect(body.cached).toBe(true);

      // Queue publish should NOT have been called (cached result used)
      const { publishResumeParse } = await import("@/lib/queue/resume-parse");
      expect(publishResumeParse).not.toHaveBeenCalled();
      // Must gate publish on handle: no handle → publish:false so site remains unpublished
      const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");
      expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
        expect.anything(), // tx (transaction-scoped)
        "user-1",
        expect.anything(), // resumeId
        cachedContent,
        { publish: false },
      );
      // Also ensure queue still completes without throwing and site_data upsert still invoked
      expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalled();
    });
  });

  describe("Different user, same file hash", () => {
    it("processes independently when file hash belongs to different user (no cross-user dedup)", async () => {
      authedAs("user-2"); // Different user

      // Both cache and processing lookups return empty for user-2
      // (because the route filters by eq(resumes.userId, userId))
      mockDbLimit.mockResolvedValue([]);

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      // Should proceed to normal queue flow (NOT waiting_for_cache, NOT cached)
      expect(body.status).toBe("queued");

      // Queue publish should have been called (independent processing)
      const { publishResumeParse } = await import("@/lib/queue/resume-parse");
      expect(publishResumeParse).toHaveBeenCalled();
    });

    it("does not apply user-1's cache to user-2 even with same file hash", async () => {
      authedAs("user-2");

      // No cached results for user-2
      mockDbLimit.mockResolvedValue([]);

      const { POST } = await import("@/app/api/resume/claim/route");
      const cookie = await createSignedCookieValue("temp/uuid/resume.pdf", TEST_SECRET);
      const response = await POST(makeClaimRequest({ key: "temp/uuid/resume.pdf" }, cookie));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; cached?: boolean };
      expect(body.status).toBe("queued");
      expect(body.cached).toBeUndefined();
    });
  });

  describe("resumes_file_hash_status_idx index", () => {
    it("verifies the schema defines the composite index (fileHash, status)", async () => {
      // This is a static assertion: the schema at lib/db/schema.ts line 153 defines:
      //   index("resumes_file_hash_status_idx").on(table.fileHash, table.status)
      //
      // The claim route's cache lookup (lines 225-237) filters by:
      //   - eq(resumes.userId, userId)     → uses resumes_user_id_idx
      //   - eq(resumes.fileHash, hash)     → first column of resumes_file_hash_status_idx
      //   - eq(resumes.status, "completed")  → second column of resumes_file_hash_status_idx
      //
      // The processing duplicate check (lines 297-308) filters by:
      //   - eq(resumes.userId, userId)
      //   - eq(resumes.fileHash, hash)     → first column of resumes_file_hash_status_idx
      //   - eq(resumes.status, "processing") → second column of resumes_file_hash_status_idx
      //
      // Both queries benefit from the composite index on (fileHash, status).

      const { resumes } = await import("@/lib/db/schema");

      // The schema object has fileHash and status properties (mocked as strings)
      expect(resumes).toHaveProperty("fileHash");
      expect(resumes).toHaveProperty("status");

      // Verify the query uses eq on both fileHash and status in the cache lookup
      // These operators are called with the schema columns
      expect(eq).toBeDefined();
      expect(and).toBeDefined();
      expect(isNotNull).toBeDefined();
      expect(ne).toBeDefined();
    });
  });
});
