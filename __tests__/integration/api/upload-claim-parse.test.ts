import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

type ClaimBody = { key: string };

type ClaimHeaders = { "Content-Type": string; Cookie?: string };

interface MockDbChain {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  for: ReturnType<typeof vi.fn>;
}

interface MockDbUpdateChain {
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  updateResult?: { set: ReturnType<typeof vi.fn> };
}

interface MockDbInsertChain {
  values: ReturnType<typeof vi.fn>;
}

interface MockDatabase {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

// Explicit contract keeps mockDb's inference from circularly depending on this callback (TS7024).
type MockTransactionOutcome = Promise<void>;

const createMockDbChain = (returnValue: JsonValue = []): MockDbChain => {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const forUpdate = vi.fn().mockResolvedValue(undefined);

  const where = vi
    .fn()
    .mockReturnValue(
      Object.assign(Promise.resolve(returnValue), { orderBy, limit, for: forUpdate }),
    );

  const from = vi.fn().mockReturnValue({ where });

  return { from, where, orderBy, limit, for: forUpdate };
};

let mockDbSelectChain = createMockDbChain([]);

let mockDbUpdateChain: MockDbUpdateChain;

let mockDbInsertChain: MockDbInsertChain;

const resetMockDbChains = () => {
  mockDbSelectChain = createMockDbChain([]);

  const updateReturning = vi.fn().mockResolvedValue([{ id: "resume-id", totalAttempts: 1 }]);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  mockDbUpdateChain = {
    set: updateSet,
    where: updateWhere,
    updateResult: { set: updateSet },
  };

  const insertValues = vi.fn().mockImplementation((values: { id?: string }) => ({
    onConflictDoUpdate: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: values.id, status: "pending_claim" }]),
    }),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([{ id: values.id }]),
  }));

  mockDbInsertChain = { values: insertValues };
};

const mockDb = {
  select: vi.fn(() => ({ from: mockDbSelectChain.from })),
  update: vi.fn(() => ({ set: mockDbUpdateChain.set })),
  insert: vi.fn(() => ({ values: mockDbInsertChain.values })),
  transaction: vi.fn(async (cb: (tx: MockDatabase) => void): MockTransactionOutcome => cb(mockDb)),
};

const mockR2Store = new Map<string, ArrayBuffer>();

const mockR2Binding: R2Bucket = {
  head: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  createMultipartUpload: vi.fn(),
  resumeMultipartUpload: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

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
  head: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string) => {
    const buf = mockR2Store.get(key);

    if (!buf) return { exists: false };

    return { exists: true, size: buf.byteLength };
  }),
};

type StartedParseRun = {
  id: string;
  params: {
    kind: string;
    resumeId: string;
    userId: string;
    r2Key: string;
    fileHash: string;
  };
};

const mockWorkflowRuns: StartedParseRun[] = [];

const mockWorkflow = {
  create: vi.fn().mockImplementation(async (run: StartedParseRun) => {
    mockWorkflowRuns.push(run);

    return { id: run.id };
  }),
  get: vi.fn().mockRejectedValue(new Error("instance not found")),
};

const TEST_COOKIE_SECRET = "test-secret-key-for-testing-only";

let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: Record<string, boolean>;
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
      privacySettings: {},
      onboardingCompleted: true,
    };
  } else {
    mockAuthUser = null;
  }
};

vi.mock("cloudflare:workers", () => ({
  env: {
    CLICKFOLIO_R2_BUCKET: mockR2Binding,
    CLICKFOLIO_PARSE_WORKFLOW: mockWorkflow,
    PENDING_UPLOAD_SECRET: TEST_COOKIE_SECRET,
  },
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn().mockImplementation(async (message: string) => {
    if (!mockAuthUser) {
      return {
        user: null,
        db: null,
        dbUser: null,
        env: null,
        error: new Response(JSON.stringify({ error: message || "Unauthorized" }), { status: 401 }),
      };
    }

    return {
      user: mockAuthUser,
      db: mockDb,
      dbUser: { id: mockAuthUser.id, handle: mockAuthUser.handle, clerkId: "user_clerk_1" },
      env: {
        HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
        CLICKFOLIO_R2_BUCKET: mockR2Binding,
        CLICKFOLIO_PARSE_WORKFLOW: mockWorkflow,
        PENDING_UPLOAD_SECRET: TEST_COOKIE_SECRET,
      },
      error: null,
    };
  }),
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn().mockReturnValue(mockR2Binding),
  R2: mockR2,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

vi.mock("@/lib/rate-limit/ip", () => ({
  checkIPRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: { hourly: 10, daily: 50 },
  }),
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/rate-limit/user", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
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
    BAD_REQUEST: "BAD_REQUEST",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  },
}));

function makePdfBuffer(content = "fake content"): ArrayBuffer {
  const header = new TextEncoder().encode(`%PDF-1.4 ${content}`);
  const result = new Uint8Array(Math.max(120, header.byteLength));
  result.set(new Uint8Array(header.buffer, header.byteOffset, header.byteLength));

  return result.buffer;
}

function makeInvalidBuffer(): ArrayBuffer {
  const data = new Uint8Array(120);
  const header = new TextEncoder().encode("NOT A PDF FILE");
  data.set(new Uint8Array(header.buffer, header.byteOffset, header.byteLength));

  return data.buffer;
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

function makeClaimRequest(key: string, cookieValue?: string): Request {
  const body: ClaimBody = { key };

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

function extractPendingUploadCookie(uploadResponse: Response): string | null {
  const setCookieHeader = uploadResponse.headers.get("Set-Cookie");

  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/pending_upload=([^;]+)/);

  return match?.[1] ?? null;
}

function resetAll() {
  vi.clearAllMocks();
  mockR2Store.clear();
  mockWorkflowRuns.length = 0;
  setMockAuthUser(null);
  resetMockDbChains();
}

describe("POST /api/upload", () => {
  beforeEach(resetAll);

  it("1. Anonymous upload → success (file stored in R2, temp key returned)", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = makeUploadRequest(buffer);

    const response = await POST(request);

    const body: {
      key: string;
      remaining: { hourly: number; daily: number };
    } = await response.json();

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^temp\/.*\.pdf$/);
    expect(body.remaining.hourly).toBe(10);
    expect(body.remaining.daily).toBe(50);
    expect(mockR2.put).toHaveBeenCalled();
  });

  it("2. Upload with invalid PDF → rejected (400 bad request)", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makeInvalidBuffer();
    const request = makeUploadRequest(buffer);

    const response = await POST(request);
    const body: { error: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("3. Upload rate limit exceeded → 429 too many requests", async () => {
    const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
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

  it("6. Upload with mismatched Content-Length → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": "999999",
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
      body: new ArrayBuffer(100),
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("10. Upload file too small → 400 error", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const tinyBuffer = new ArrayBuffer(50);

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

describe("POST /api/resume/claim", () => {
  beforeEach(resetAll);

  it("11. Claim upload with valid auth → success (resume created, queue triggered)", async () => {
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody: { key: string } = await uploadResponse.json();
    const tempKey = uploadBody.key;

    expect(mockR2Store.has(tempKey)).toBe(true);

    const pendingCookie = extractPendingUploadCookie(uploadResponse);
    expect(pendingCookie).not.toBeNull();

    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const claimResponse = await claimPost(makeClaimRequest(tempKey, pendingCookie!));
    const claimBody: { resume_id: string; status: string } = await claimResponse.json();

    expect(claimResponse.status).toBe(200);
    expect(claimBody.status).toBe("queued");
    expect(claimBody.resume_id).toBeDefined();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockWorkflowRuns.length).toBe(1);
    expect(mockWorkflowRuns[0].id).toBe(claimBody.resume_id);
  });

  it("12. Claim without auth → 401 unauthorized", async () => {
    setMockAuthUser(null);
    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("temp/test/file.pdf"));

    expect(response.status).toBe(401);
  });

  it("15. Claim with queue trigger → verify message sent to queue", async () => {
    const { POST: uploadPost } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const uploadResponse = await uploadPost(makeUploadRequest(buffer));
    const uploadBody: { key: string } = await uploadResponse.json();

    const pendingCookie = extractPendingUploadCookie(uploadResponse);
    expect(pendingCookie).not.toBeNull();

    setMockAuthUser("user-1");
    const { POST: claimPost } = await import("@/app/api/resume/claim/route");
    const claimResponse = await claimPost(makeClaimRequest(uploadBody.key, pendingCookie!));
    const claimBody: { resume_id: string } = await claimResponse.json();

    expect(mockWorkflowRuns.length).toBe(1);
    expect(mockWorkflowRuns[0]).toMatchObject({
      id: claimBody.resume_id,
      params: { kind: "parse", resumeId: claimBody.resume_id, userId: "user-1" },
    });
    expect(mockWorkflowRuns[0].params.r2Key).toMatch(/^users\/user-1\//);
    expect(mockWorkflowRuns[0].params.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("16. Claim with invalid temp key → 404/400 error", async () => {
    setMockAuthUser("user-1");
    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("invalid-key-format"));

    expect(response.status).toBe(400);
  });

  it("20. Claim with rate limit exceeded → 429 error", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit/user");
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 }),
    );

    setMockAuthUser("user-1");

    const tempKey = "temp/test/file.pdf";
    const cookieValue = await createSignedCookieValue(tempKey, TEST_COOKIE_SECRET);
    mockR2Store.set(tempKey, makePdfBuffer());

    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest(tempKey, cookieValue));

    expect(response.status).toBe(429);
  });
});

describe("Parse pipeline → siteData Creation", () => {
  beforeEach(resetAll);

  // SAFETY: env stub declares only HYPERDRIVE and CLICKFOLIO_R2_BUCKET, the two bindings the pipeline steps read; CloudflareEnv's remaining properties are never accessed on this path.
  const env = {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    CLICKFOLIO_R2_BUCKET: mockR2Binding,
  } as CloudflareEnv;

  it("22. Transient parse failure → retryable ParseError for the workflow step", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    const { ParseError, ParseErrorType } = await import("@/lib/parse/errors");

    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;

    mockR2Store.set(r2Key, makePdfBuffer());

    vi.doMock("@/lib/ai", () => ({
      parseResumeWithAi: vi
        .fn()
        .mockRejectedValue(new ParseError(ParseErrorType.AI_PROVIDER_ERROR, "AI provider timeout")),
    }));

    const job = { resumeId: crypto.randomUUID(), userId, r2Key, fileHash: "abc123".repeat(8) };
    await expect(parseResumePdf(job, env)).rejects.toSatisfy(
      (error: InstanceType<typeof ParseError>) =>
        error instanceof ParseError && error.isRetryable(),
    );
  });

  it("25. Claim with cached fileHash → skip AI, complete from cache", async () => {
    const { claimResumeForParse } = await import("@/lib/parse/pipeline");

    const userId = "user-1";

    const job = {
      resumeId: crypto.randomUUID(),
      userId,
      r2Key: `users/${userId}/123456/resume.pdf`,
      fileHash: "abc123".repeat(8),
    };

    mockDbSelectChain.limit.mockResolvedValueOnce([{ status: "queued" }]);
    mockDbSelectChain.limit.mockResolvedValueOnce([{ parsedContent: { name: "Cached User" } }]);

    await expect(claimResumeForParse(job, env)).resolves.toBe("cached");
    expect(mockDb.transaction).toHaveBeenCalled();
  });
});

describe("POST /api/upload/pending - R2 existence check (hardening)", () => {
  beforeEach(resetAll);

  it("26. POST /api/upload/pending with unknown temp key → 404 (object not in R2)", async () => {
    const { POST } = await import("@/app/api/upload/pending/route");

    const request = new Request("http://localhost:3000/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "temp/attacker-invented-uuid/victim.pdf" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    const body: { error: string } = await response.json();
    expect(body.error).toContain("Upload not found");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("27. POST /api/upload/pending with invalid key prefix → 400", async () => {
    const { POST } = await import("@/app/api/upload/pending/route");

    const request = new Request("http://localhost:3000/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "users/some-user/legitimate.pdf" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body: { error: string } = await response.json();
    expect(body.error).toContain("Invalid upload key");
  });

  it("28. POST /api/upload/pending with key that exists in R2 → 200 and cookie set", async () => {
    const { POST } = await import("@/app/api/upload/pending/route");
    const tempKey = "temp/real-uuid/my-resume.pdf";
    mockR2Store.set(tempKey, makePdfBuffer());

    const request = new Request("http://localhost:3000/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: tempKey }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body: { success: boolean } = await response.json();
    expect(body.success).toBe(true);
  });
});
