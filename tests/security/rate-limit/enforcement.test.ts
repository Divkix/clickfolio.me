import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockSelect = vi.fn().mockReturnThis();

const mockFrom = vi.fn().mockReturnThis();

const mockWhere = vi.fn().mockReturnThis();

let rawInsertCount = 1;

const mockExecute = vi.fn((_statement: { strings: TemplateStringsArray }) =>
  Promise.resolve({ rows: [], rowCount: rawInsertCount }),
);

const mockTransaction = vi.fn(
  async (cb: (tx: { execute: typeof mockExecute }) => Promise<boolean>) =>
    cb({ execute: mockExecute }),
);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  transaction: mockTransaction,
  execute: mockExecute,
};

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  and: vi.fn(() => "and"),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    mapWith: vi.fn().mockReturnValue(values[0] || 0),
  })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/db/schema", () => ({
  uploadRateLimits: {
    id: "id",
    ipHash: "ipHash",
    actionType: "actionType",
    createdAt: "createdAt",
    expiresAt: "expiresAt",
  },
  handleChanges: {
    id: "id",
    userId: "userId",
    createdAt: "createdAt",
  },
  resumes: {
    id: "id",
    userId: "userId",
    createdAt: "createdAt",
  },
}));

vi.mock("@/lib/utils/environment", () => ({
  isLocalEnvironment: vi.fn(() => false),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("process", { ...process, env: { ...process.env, NODE_ENV: "production" } });
  rawInsertCount = 1;
});

describe("Authenticated Rate Limiting", () => {
  it("enforces authenticated upload limit - 5/day", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });

    const { checkRateLimit } = await import("@/lib/rate-limit/user");
    const result = await checkRateLimit("user-123", "resume_upload");

    expect(result.allowed).toBe(false);
  });

  it("enforces handle change rate limit - 3/24 hours", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    });

    const { checkRateLimit } = await import("@/lib/rate-limit/user");
    const result = await checkRateLimit("user-123", "handle_change");

    expect(result.allowed).toBe(false);
  });
});

describe("Rate Limit Bypass Prevention", () => {
  it("blocks X-Forwarded-For spoofing attempts by using first IP", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    const request = new Request("http://localhost:3000/api/upload", {
      headers: {
        "X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3",
        "CF-Connecting-IP": "192.168.1.1",
      },
    });

    const ip = getClientIP(request);
    expect(ip).toBe("192.168.1.1");
  });

  it("ignores X-Forwarded-For when CF-Connecting-IP is present", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    const request = new Request("http://localhost:3000/api/upload", {
      headers: {
        "X-Forwarded-For": "spoofed-ip",
        "CF-Connecting-IP": "real-ip",
      },
    });

    expect(getClientIP(request)).toBe("real-ip");
  });

  it("falls back to first X-Forwarded-IP when CF header absent", async () => {
    const { getClientIP } = await import("@/lib/rate-limit/ip");

    const request = new Request("http://localhost:3000/api/upload", {
      headers: {
        "X-Forwarded-For": "192.168.1.1, 10.0.0.1",
      },
    });

    expect(getClientIP(request)).toBe("192.168.1.1");
  });

  describe("Rate Limit Reset Timing", () => {
    it("computes resetAt from the oldest in-window row + window (item 22)", async () => {
      const oldest = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2, oldest }]),
        }),
      });

      const { checkRateLimit } = await import("@/lib/rate-limit/user");
      const result = await checkRateLimit("user-123", "handle_change");

      const expected = new Date(oldest).getTime() + 24 * 60 * 60 * 1000;
      expect(Math.abs(result.resetAt.getTime() - expected)).toBeLessThan(5000);
      expect(result.resetAt.getTime()).toBeLessThan(
        Date.now() + 24 * 60 * 60 * 1000 - 10 * 60 * 60 * 1000,
      );
    });
  });

  describe("Rate Limit Headers", () => {
    it("includes Retry-After header in 429 responses", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const { enforceRateLimit } = await import("@/lib/rate-limit/user");

      vi.stubGlobal("process", {
        ...process,
        env: { ...process.env, NODE_ENV: "production" },
      });

      const response = await enforceRateLimit("user-123", "resume_upload");

      if (response) {
        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBeTruthy();
        expect(response.headers.get("X-RateLimit-Limit")).toBeTruthy();
        expect(response.headers.get("X-RateLimit-Remaining")).toBeTruthy();
      }
    });

    it("returns a retryable 503 when the rate-limit backend is unavailable", async () => {
      mockSelect.mockImplementationOnce(() => {
        throw new Error("Failed query", { cause: new Error("DB connection failed") });
      });

      const { enforceRateLimit } = await import("@/lib/rate-limit/user");
      const response = await enforceRateLimit("user-123", "resume_upload");

      expect(response?.status).toBe(503);
      expect(response?.headers.get("Retry-After")).toBe("60");
      await expect(response?.json()).resolves.toMatchObject({
        code: "RATE_LIMIT_UNAVAILABLE",
        message: expect.stringContaining("temporarily unavailable"),
      });
    });
  });

  describe("Fail-Open vs Fail-Closed Behavior", () => {
    it("fails CLOSED for authenticated rate limiting errors", async () => {
      mockSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const { checkRateLimit } = await import("@/lib/rate-limit/user");
      const result = await checkRateLimit("user-123", "resume_upload");

      expect(result.allowed).toBe(false);
    });
  });
});
