import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ orderBy: mockDbOrderBy, limit: mockDbLimit });
mockDbOrderBy.mockReturnValue({ limit: mockDbLimit });
mockDbLimit.mockResolvedValue([]);

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

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args: JsonValue[]) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  gte: vi.fn((_col, val) => ({ gte: val })),
  ne: vi.fn((_col, val) => ({ ne: val })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
  inArray: vi.fn((_col, vals: JsonValue[]) => ({ inArray: vals })),
}));

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

vi.mock("@/lib/rate-limit/user", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

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

vi.mock("@/lib/queue/resume-parse", () => ({
  publishResumeParse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: vi.fn().mockReturnValue("mock-upsert-query"),
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
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  },
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

type ClaimHeaders = { "Content-Type": string; Cookie?: string };

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

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
    env: {
      CLICKFOLIO_PARSE_QUEUE: {},
      PENDING_UPLOAD_SECRET: "test-secret-key-for-testing-only",
    } as never,
    error: null,
  });
}

async function createSignedCookieValue(
  tempKey: string,
  secret: string,
  expiresAt?: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const actualExpiresAt = expiresAt ?? Date.now() + 30 * 60 * 1000;
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
  mockHandleRows = [{ handle: "test-handle" }];
  mockR2GetAsArrayBuffer.mockResolvedValue(makePdfBuffer());
  mockDbLimit.mockResolvedValue([]);
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

    const expiredTimestamp = Date.now() - 1000;
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

    expect(mockR2Put).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("uses handle-aware mock: cached path with no handle → publish:false", async () => {
    authedAs("user-1");

    const cachedContent = { full_name: "Test User" };
    mockDbLimit.mockResolvedValue([{ id: "cached-resume", parsedContent: cachedContent }]);
    mockHandleRows = [];

    const validCookie = await createSignedCookieValue(VALID_TEMP_KEY, TEST_SECRET);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest({ key: VALID_TEMP_KEY }, validCookie));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; cached?: boolean };
    expect(body.status).toBe("completed");
    expect(body.cached).toBe(true);

    const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");
    expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.anything(),
      cachedContent,
      { publish: false },
    );
    expect(mockDbTransaction).toHaveBeenCalled();
  });
});
