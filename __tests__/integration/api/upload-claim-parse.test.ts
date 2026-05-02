import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for POST /api/upload and POST /api/resume/claim
 * Tests the complete upload-claim-parse flow with mocked D1, R2, Queue, and AI
 */

// ── Type Definitions ────────────────────────────────────────────────

interface MockDbChain {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
}

interface MockDbUpdateChain {
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  updateResult?: { set: ReturnType<typeof vi.fn> };
}

interface MockDbInsertChain {
  values: ReturnType<typeof vi.fn>;
}

// ── Mock Setup ──────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);

// Database mock builders
const createMockDbChain = (returnValue: unknown = []): MockDbChain => {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy, limit });
  const from = vi.fn().mockReturnValue({ where });

  return { from, where, orderBy, limit };
};

let mockDbSelectChain = createMockDbChain([]);
let mockDbUpdateChain: MockDbUpdateChain;
let mockDbInsertChain: MockDbInsertChain;
let mockDbBatchResult: unknown;

const resetMockDbChains = () => {
  mockDbSelectChain = createMockDbChain([]);

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  // db.update() should return an object with a set() method
  mockDbUpdateChain = {
    set: updateSet,
    where: updateWhere,
    // The result of db.update(table) - should be callable as a function that returns { set: updateSet }
    updateResult: { set: updateSet },
  };

  const insertValues = vi.fn().mockResolvedValue(undefined);
  mockDbInsertChain = { values: insertValues };
};

const mockDb = {
  // db.select() should return an object with .from() method
  select: vi.fn(() => ({ from: mockDbSelectChain.from })),
  // db.update(table) should return an object with .set() method
  update: vi.fn(() => ({ set: mockDbUpdateChain.set })),
  insert: vi.fn(() => mockDbInsertChain.values),
  batch: vi.fn().mockImplementation(() => Promise.resolve(mockDbBatchResult)),
};

// R2 mock
const mockR2Store = new Map<string, ArrayBuffer>();
const mockR2Binding = {} as R2Bucket;

const mockR2 = {
  getAsArrayBuffer: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string) => {
    return mockR2Store.get(key) ?? null;
  }),
  put: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string, data: ArrayBuffer) => {
    mockR2Store.set(key, data);
  }),
  delete: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string) => {
    mockR2Store.delete(key);
  }),
};

// Queue mock
const mockQueueMessages: Array<{
  resumeId: string;
  userId: string;
  r2Key: string;
  fileHash: string;
  attempt: number;
}> = [];

const mockQueue = {
  send: vi.fn().mockImplementation(async (message: unknown) => {
    mockQueueMessages.push(message as (typeof mockQueueMessages)[0]);
  }),
};

// Cookie helper for claim route testing - declared before mocks so auth mock can use it
const TEST_COOKIE_SECRET = "test-secret-key-for-testing-only";

// Auth mock
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: string;
  onboardingCompleted: boolean;
} | null = null;

const setMockAuthUser = (userId: string | null) => {
  if (userId) {
    mockAuthUser = {
      id: userId,
      email: `${userId}@test.com`,
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: "{}",
      onboardingCompleted: true,
    };
  } else {
    mockAuthUser = null;
  }
};

// ── Module Mocks ─────────────────────────────────────────────────────

vi.mock("cloudflare:workers", () => ({
  env: {
    CLICKFOLIO_R2_BUCKET: mockR2Binding,
    CLICKFOLIO_PARSE_QUEUE: mockQueue,
  },
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn().mockImplementation(async (message: string) => {
    if (!mockAuthUser) {
      return {
        user: null,
        db: null,
        captureBookmark: null,
        dbUser: null,
        env: null,
        error: new Response(JSON.stringify({ error: message || "Unauthorized" }), { status: 401 }),
      };
    }
    return {
      user: mockAuthUser,
      db: mockDb,
      captureBookmark: mockCaptureBookmark,
      dbUser: { id: mockAuthUser.id, handle: mockAuthUser.handle },
      env: {
        CLICKFOLIO_R2_BUCKET: mockR2Binding,
        CLICKFOLIO_PARSE_QUEUE: mockQueue,
        BETTER_AUTH_SECRET: TEST_COOKIE_SECRET,
      },
      error: null,
    };
  }),
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn().mockReturnValue(mockR2Binding),
  R2: mockR2,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

vi.mock("@/lib/db/session", () => ({
  getSessionDbForWebhook: vi.fn().mockReturnValue({ db: mockDb }),
  getSessionDbWithPrimaryFirst: vi.fn().mockResolvedValue({
    db: mockDb,
    captureBookmark: mockCaptureBookmark,
  }),
}));

vi.mock("@/lib/utils/ip-rate-limit", () => ({
  checkIPRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: { hourly: 10, daily: 50 },
  }),
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/queue/resume-parse", () => ({
  publishResumeParse: vi.fn().mockImplementation(async (queue, params) => {
    await queue.send({
      type: "parse",
      ...params,
    });
  }),
}));

vi.mock("@/lib/referral", () => ({
  writeReferral: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: vi.fn().mockReturnValue("mock-upsert-query"),
}));

vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn((error: string, _code: string, status: number) => {
    return new Response(JSON.stringify({ error }), { status });
  }),
  createSuccessResponse: vi.fn((data: unknown) => {
    return new Response(JSON.stringify(data), { status: 200 });
  }),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    BAD_REQUEST: "BAD_REQUEST",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a valid PDF buffer (starts with %PDF- magic bytes) */
function makePdfBuffer(content = "fake content"): ArrayBuffer {
  const header = new TextEncoder().encode(`%PDF-1.4 ${content}`);
  return header.buffer.slice(header.byteOffset, header.byteOffset + header.byteLength);
}

/** Create an invalid PDF buffer */
function makeInvalidBuffer(): ArrayBuffer {
  const data = new TextEncoder().encode("NOT A PDF FILE");
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

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

/** Create upload request */
function makeUploadRequest(
  buffer: ArrayBuffer,
  filename = "test-resume.pdf",
  contentType = "application/pdf",
): Request {
  return new Request("http://localhost:3000/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "X-Filename": filename,
    },
    body: buffer,
  });
}

/** Create claim request */
function makeClaimRequest(key: string, referralCode?: string, cookieValue?: string): Request {
  const body: Record<string, string> = { key };
  if (referralCode) body.referral_code = referralCode;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookieValue) {
    headers["Cookie"] = `pending_upload=${cookieValue}`;
  }

  return new Request("http://localhost:3000/api/resume/claim", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Reset all mocks and state */
function resetAll() {
  vi.clearAllMocks();
  mockR2Store.clear();
  mockQueueMessages.length = 0;
  setMockAuthUser(null);
  resetMockDbChains();
  mockDbBatchResult = undefined;
}

// ── Tests: Upload ───────────────────────────────────────────────────

describe("POST /api/upload", () => {
  beforeEach(resetAll);

  it.skip("1. Anonymous upload → success (file stored in R2, temp key returned)", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = makeUploadRequest(buffer);

    const response = await POST(request);
    const body = (await response.json()) as {
      key: string;
      remaining: { hourly: number; daily: number };
    };

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^temp\/.*\.pdf$/);
    expect(body.remaining.hourly).toBe(10);
    expect(body.remaining.daily).toBe(50);
    expect(mockR2.put).toHaveBeenCalled();
  });

  it.skip("2. Upload with invalid PDF → rejected (400 bad request)", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makeInvalidBuffer();
    const request = makeUploadRequest(buffer);

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it.skip("3. Upload rate limit exceeded → 429 too many requests", async () => {
    const { checkIPRateLimit } = await import("@/lib/utils/ip-rate-limit");
    vi.mocked(checkIPRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: { hourly: 0, daily: 50 },
      message: "Rate limit exceeded",
    });

    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = makeUploadRequest(buffer);

    const response = await POST(request);

    expect(response.status).toBe(429);
  });

  it("4. Upload without Content-Type → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Length": String(buffer.byteLength),
        "X-Filename": "test.pdf",
      },
      body: buffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("5. Upload without Content-Length → 411 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Filename": "test.pdf",
      },
      body: buffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(411);
  });

  it.skip("6. Upload with mismatched Content-Length → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": "999999", // Wrong size
        "X-Filename": "test.pdf",
      },
      body: buffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("7. Upload without X-Filename → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.byteLength),
      },
      body: buffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("8. Upload with filename too long → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const longFilename = `${"a".repeat(300)}.pdf`;
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.byteLength),
        "X-Filename": longFilename,
      },
      body: buffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("9. Upload file too large → 413 error", async () => {
    const { MAX_FILE_SIZE } = await import("@/lib/utils/validation");
    const { POST } = await import("@/app/api/upload/route");
    const largeSize = MAX_FILE_SIZE + 1;
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(largeSize),
        "X-Filename": "large.pdf",
      },
      body: new ArrayBuffer(100), // Smaller actual body
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("10. Upload file too small → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const tinyBuffer = new ArrayBuffer(50); // Less than MIN_PDF_SIZE (100)
    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": "50",
        "X-Filename": "tiny.pdf",
      },
      body: tinyBuffer,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

// ── Tests: Claim ────────────────────────────────────────────────────

describe("POST /api/resume/claim", () => {
  beforeEach(resetAll);

  it.skip("11. Claim upload with valid auth → success (resume created, queue triggered)", async () => {
    // First upload a file
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };
    const tempKey = uploadBody.key;

    // Verify file is in R2
    expect(mockR2Store.has(tempKey)).toBe(true);

    // Now claim it
    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const claimResponse = await claimPost(makeClaimRequest(tempKey));
    const claimBody = (await claimResponse.json()) as { resume_id: string; status: string };

    expect(claimResponse.status).toBe(200);
    expect(claimBody.status).toBe("queued");
    expect(claimBody.resume_id).toBeDefined();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockQueueMessages.length).toBe(1);
    expect(mockQueueMessages[0].resumeId).toBe(claimBody.resume_id);
  });

  it("12. Claim without auth → 401 unauthorized", async () => {
    setMockAuthUser(null);
    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("temp/test/file.pdf"));

    expect(response.status).toBe(401);
  });

  it.skip("13. Claim already claimed upload → 409 conflict (returns already_claimed)", async () => {
    // Upload and claim once
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };

    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const firstClaim = await claimPost(makeClaimRequest(uploadBody.key));
    const firstBody = (await firstClaim.json()) as { resume_id: string };

    // Simulate file being moved and recent resume found
    mockR2Store.delete(uploadBody.key);
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        id: firstBody.resume_id,
        status: "processing",
      },
    ]);

    // Try to claim again
    const secondClaim = await claimPost(makeClaimRequest(uploadBody.key));
    const secondBody = (await secondClaim.json()) as {
      already_claimed: boolean;
      resume_id: string;
    };

    expect(secondClaim.status).toBe(200);
    expect(secondBody.already_claimed).toBe(true);
    expect(secondBody.resume_id).toBe(firstBody.resume_id);
  });

  it.skip("14. Claim non-existent upload → 404 not found", async () => {
    setMockAuthUser("user-1");
    mockDbSelectChain.limit.mockResolvedValueOnce([]); // No recent resume

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("temp/nonexistent/file.pdf"));

    expect(response.status).toBe(404);
  });

  it.skip("15. Claim with queue trigger → verify message sent to queue", async () => {
    // Upload
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };

    // Claim
    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const claimResponse = await claimPost(makeClaimRequest(uploadBody.key));
    const claimBody = (await claimResponse.json()) as { resume_id: string };

    expect(mockQueueMessages.length).toBe(1);
    expect(mockQueueMessages[0]).toMatchObject({
      type: "parse",
      resumeId: claimBody.resume_id,
      userId: "user-1",
      attempt: 1,
    });
    expect(mockQueueMessages[0].r2Key).toMatch(/^users\/user-1\//);
    expect(mockQueueMessages[0].fileHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("16. Claim with invalid temp key → 404/400 error", async () => {
    setMockAuthUser("user-1");
    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("invalid-key-format"));

    expect(response.status).toBe(400);
  });

  it.skip("17. Claim with referral code → referral linked", async () => {
    const { writeReferral } = await import("@/lib/referral");

    // Upload
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };

    // Claim with referral code
    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    await claimPost(makeClaimRequest(uploadBody.key, "REF123"));

    expect(writeReferral).toHaveBeenCalledWith("user-1", "REF123", expect.any(Request));
  });

  it.skip("18. Double upload (same file hash) → uses cached result", async () => {
    // Upload once
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer("unique content");
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };

    // First claim - should create resume and queue
    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const firstClaim = await claimPost(makeClaimRequest(uploadBody.key));
    const firstBody = (await firstClaim.json()) as { resume_id: string; status: string };
    expect(firstBody.status).toBe("queued");

    // Simulate that the first resume completed with parsed content
    const cachedContent = JSON.stringify({ name: "Test User", experience: [] });
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        id: "previous-resume",
        parsedContent: cachedContent,
      },
    ]);

    // Second upload with same content (different temp key)
    const secondUploadResponse = await uploadPost(makeUploadRequest(buffer));
    const secondUploadBody = (await secondUploadResponse.json()) as { key: string };

    // Second claim - should use cache
    const secondClaim = await claimPost(makeClaimRequest(secondUploadBody.key));
    const secondBody = (await secondClaim.json()) as { status: string; cached?: boolean };

    expect(secondBody.status).toBe("completed");
    expect(secondBody.cached).toBe(true);
  });

  it.skip("19. Claim with processing file hash → waits for cache", async () => {
    // Upload
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer("processing content");
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody = (await uploadResponse.json()) as { key: string };

    // First claim - creates resume and queues
    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const firstClaim = await claimPost(makeClaimRequest(uploadBody.key));
    const firstBody = (await firstClaim.json()) as { resume_id: string };

    // Simulate first resume still processing
    mockDbSelectChain.limit.mockResolvedValueOnce([]); // No completed cache
    mockDbSelectChain.limit.mockResolvedValueOnce([{ id: firstBody.resume_id }]); // But processing

    // Second claim with same content
    const secondUploadResponse = await uploadPost(makeUploadRequest(buffer));
    const secondUploadBody = (await secondUploadResponse.json()) as { key: string };

    const secondClaim = await claimPost(makeClaimRequest(secondUploadBody.key));
    const secondBody = (await secondClaim.json()) as {
      status: string;
      waiting_for_cache?: boolean;
    };

    expect(secondBody.status).toBe("processing");
    expect(secondBody.waiting_for_cache).toBe(true);
  });

  it("20. Claim with rate limit exceeded → 429 error", async () => {
    const { enforceRateLimit } = await import("@/lib/utils/rate-limit");
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 }),
    );

    setMockAuthUser("user-1");

    // Create a valid cookie for the temp key
    const tempKey = "temp/test/file.pdf";
    const cookieValue = await createSignedCookieValue(tempKey, TEST_COOKIE_SECRET);

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest(tempKey, undefined, cookieValue));

    expect(response.status).toBe(429);
  });
});

// ── Tests: Parse Flow Completion ───────────────────────────────────

describe("Queue Processing → siteData Creation", () => {
  beforeEach(resetAll);

  it.skip("21. Parse flow completion → verify siteData created in D1", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    // Setup: Create a resume in queued state
    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;
    const fileHash = "abc123".repeat(8); // 48 chars, simplified hash

    // Put file in R2
    mockR2Store.set(r2Key, makePdfBuffer());

    // Mock AI parsing
    const mockParsedContent = JSON.stringify({
      name: "John Doe",
      headline: "Software Engineer",
      contact: { email: "john@example.com" },
      experience: [],
      education: [],
      skills: [],
    });

    vi.doMock("@/lib/ai", () => ({
      parseResumeWithAi: vi.fn().mockResolvedValue({
        success: true,
        parsedContent: mockParsedContent,
        professionalLevel: "mid_level",
      }),
    }));

    // Resume starts in queued status, no staged content
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        status: "queued",
        parsedContent: null,
        parsedContentStaged: null,
        totalAttempts: 0,
      },
    ]);

    // No cached result
    mockDbSelectChain.limit.mockResolvedValueOnce([]);

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key,
      fileHash,
      attempt: 1,
    };

    const env = {
      CLICKFOLIO_R2_BUCKET: mockR2Binding,
      CLICKFOLIO_DB: {} as D1Database,
    } as CloudflareEnv;

    await handleQueueMessage(message, env);

    // Verify batch was called (resume update + siteData upsert)
    expect(mockDb.batch).toHaveBeenCalled();
    const batchCalls = vi.mocked(mockDb.batch).mock.calls;
    expect(batchCalls.length).toBeGreaterThan(0);
  });

  it("22. Parse failure → verify retry mechanism triggered", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");
    const { QueueError, QueueErrorType } = await import("@/lib/queue/errors");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;
    const fileHash = "abc123".repeat(8);

    mockR2Store.set(r2Key, makePdfBuffer());

    // Resume in queued state
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        status: "queued",
        parsedContent: null,
        parsedContentStaged: null,
        totalAttempts: 0,
      },
    ]);
    // No cache
    mockDbSelectChain.limit.mockResolvedValueOnce([]);

    // Mock AI to throw a retryable error
    vi.doMock("@/lib/ai", () => ({
      parseResumeWithAi: vi
        .fn()
        .mockRejectedValue(new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "AI provider timeout")),
    }));

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key,
      fileHash,
      attempt: 1,
    };

    const env = {
      CLICKFOLIO_R2_BUCKET: mockR2Binding,
      CLICKFOLIO_DB: {} as D1Database,
    } as CloudflareEnv;

    // Should throw for retry
    await expect(handleQueueMessage(message, env)).rejects.toThrow();
  });

  it.skip("23. Parse with staged content → resumes from stage", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;
    const fileHash = "abc123".repeat(8);

    const stagedContent = JSON.stringify({
      name: "Jane Doe",
      headline: "Designer",
      contact: {},
      experience: [],
      education: [],
      skills: [],
    });

    // Resume has staged content from previous attempt
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        status: "queued",
        parsedContent: null,
        parsedContentStaged: stagedContent,
        totalAttempts: 1,
      },
    ]);

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key,
      fileHash,
      attempt: 2,
    };

    const env = {
      CLICKFOLIO_R2_BUCKET: mockR2Binding,
      CLICKFOLIO_DB: {} as D1Database,
    } as CloudflareEnv;

    await handleQueueMessage(message, env);

    // Should use staged content without re-parsing
    expect(mockDb.batch).toHaveBeenCalled();
  });

  it.skip("24. Process already completed → idempotent skip", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;
    const fileHash = "abc123".repeat(8);

    const existingContent = JSON.stringify({ name: "Already Done" });

    // Resume already completed with parsed content
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        status: "completed",
        parsedContent: existingContent,
        parsedContentStaged: null,
        totalAttempts: 1,
      },
    ]);

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key,
      fileHash,
      attempt: 1,
    };

    const env = {
      CLICKFOLIO_R2_BUCKET: mockR2Binding,
      CLICKFOLIO_DB: {} as D1Database,
    } as CloudflareEnv;

    // Should complete without errors
    await expect(handleQueueMessage(message, env)).resolves.not.toThrow();

    // Should not have called batch since it was already completed
    expect(mockDb.batch).not.toHaveBeenCalled();
  });

  it("25. Process with cached fileHash → skip AI, use cached siteData", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;
    const fileHash = "abc123".repeat(8);

    const cachedContent = JSON.stringify({ name: "Cached User" });

    // No staged content, not completed
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        status: "queued",
        parsedContent: null,
        parsedContentStaged: null,
        totalAttempts: 0,
      },
    ]);

    // But has cached result from same fileHash
    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        id: "cached-resume",
        parsedContent: cachedContent,
      },
    ]);

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key,
      fileHash,
      attempt: 1,
    };

    const env = {
      CLICKFOLIO_R2_BUCKET: mockR2Binding,
      CLICKFOLIO_DB: {} as D1Database,
    } as CloudflareEnv;

    await handleQueueMessage(message, env);

    // Should use cache without calling AI
    expect(mockDb.batch).toHaveBeenCalled();
  });
});
