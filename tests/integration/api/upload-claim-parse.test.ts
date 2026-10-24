import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RateLimited } from "@/lib/effect/failures";
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

// The bucket the real R2Store talks to;
const mockR2Binding = {
  head: vi.fn(async (key: string) => {
    const buf = mockR2Store.get(key);

    return buf ? { size: buf.byteLength, etag: "etag" } : null;
  }),
  get: vi.fn(async (key: string) => {
    const buf = mockR2Store.get(key);

    return buf ? { arrayBuffer: async () => buf } : null;
  }),
  put: vi.fn(async (key: string, body: ArrayBuffer) => {
    mockR2Store.set(key, body);

    return { size: body.byteLength, etag: "etag" };
  }),
  delete: vi.fn(async (key: string) => {
    mockR2Store.delete(key);
  }),
  list: vi.fn(),
};

const mockWorkflow = {
  create: vi.fn().mockResolvedValue({ id: "parse-run-1" }),
  get: vi.fn().mockRejectedValue(new Error("instance not found")),
};

const TEST_COOKIE_SECRET = "test-secret-key-for-testing-only";

vi.mock("cloudflare:workers", () => ({
  env: {
    CLICKFOLIO_R2_BUCKET: mockR2Binding,
    CLICKFOLIO_PARSE_WORKFLOW: mockWorkflow,
    PENDING_UPLOAD_SECRET: TEST_COOKIE_SECRET,
  },
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
  checkIPRateLimitEffect: vi.fn(() => Effect.succeed({ remaining: { hourly: 10, daily: 50 } })),
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
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

function resetAll() {
  vi.clearAllMocks();
  mockR2Store.clear();
  resetMockDbChains();
}

describe("POST /api/upload", () => {
  beforeEach(resetAll);

  it("1. Anonymous upload → success (file stored in R2, temp key returned)", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const buffer = makePdfBuffer();
    const request = makeUploadRequest(buffer);
    const info = vi.spyOn(console, "log").mockImplementation(() => {});

    const response = await POST(request);

    const body: {
      key: string;
      remaining: { hourly: number; daily: number };
    } = await response.json();

    const events = info.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "resume_uploaded",
        size_bytes: buffer.byteLength,
        duration_ms: expect.any(Number),
      }),
    );
    info.mockRestore();

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^temp\/.*\.pdf$/);
    expect(body.remaining.hourly).toBe(10);
    expect(body.remaining.daily).toBe(50);
    expect(mockR2Binding.put).toHaveBeenCalled();
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
    const { checkIPRateLimitEffect } = await import("@/lib/rate-limit/ip");
    vi.mocked(checkIPRateLimitEffect).mockReturnValueOnce(
      Effect.fail(new RateLimited({ message: "Rate limit exceeded", retryAfterSeconds: 3600 })),
    );

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

  it("12. Claim without auth → 401 unauthorized", async () => {
    const { POST } = await import("@/app/api/resume/claim/route");
    const response = await POST(makeClaimRequest("temp/test/file.pdf"));

    expect(response.status).toBe(401);
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
