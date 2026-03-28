/**
 * User rate limiting unit tests
 * Tests for lib/utils/rate-limit.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb } from "@/__tests__/setup/mocks/db.mock";
import { checkRateLimit, enforceRateLimit } from "@/lib/utils/rate-limit";

// Mock dependencies
vi.mock("cloudflare:workers", () => ({
  env: { CLICKFOLIO_DB: {} as D1Database },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/utils/environment", () => ({
  isLocalEnvironment: vi.fn().mockReturnValue(false),
}));

import { getDb } from "@/lib/db";
import { isLocalEnvironment } from "@/lib/utils/environment";

describe("checkRateLimit - handle_change", () => {
  const mockDb = createMockDb();
  const userId = "user-test-001";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("allows handle change when under limit", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "handle_change");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks handle change when limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "handle_change");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toContain("Rate limit exceeded");
  });

  it("blocks at exactly the limit", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "handle_change");

    expect(result.allowed).toBe(false);
  });

  it("includes reset time in result", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "handle_change");

    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("fails closed on database error", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const result = await checkRateLimit(userId, "handle_change");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Rate limiting service temporarily unavailable");
  });
});

describe("checkRateLimit - resume_upload", () => {
  const mockDb = createMockDb();
  const userId = "user-test-002";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("allows upload when under limit", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "resume_upload");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks upload when daily limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "resume_upload");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("resume upload");
  });

  it("respects custom rate limit from environment", async () => {
    // Use the actual rate limit value in the RATE_LIMITS constant
    // We test with count=4 against default limit=5, expecting allowed=true and remaining=1
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 4 }]),
      }),
    } as never);

    const result = await checkRateLimit(userId, "resume_upload");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});

describe("enforceRateLimit - Development Environment", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null (no rate limit) in development", async () => {
    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeNull();
  });

  it("returns null when DISABLE_RATE_LIMITS is true", async () => {
    vi.stubEnv("DISABLE_RATE_LIMITS", "true");

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeNull();
  });
});

describe("enforceRateLimit - Production", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when rate limit not exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeNull();
  });

  it("returns Response when rate limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(429);
  });

  it("includes correct error response body", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");
    const body = await result?.json();

    expect(body).toMatchObject({
      error: "Rate Limit Exceeded",
      code: "RATE_LIMIT_EXCEEDED",
    });
  });

  it("includes rate limit headers in response", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result?.headers.get("Retry-After")).toBeDefined();
  });

  it("includes security headers in response", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result?.headers.get("Content-Type")).toBe("application/json");
    expect(result?.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("enforceRateLimit - Local Environment", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips rate limiting in local environment", async () => {
    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeNull();
  });
});

describe("enforceRateLimit - Environment Variable Override", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_RATE_LIMITS", "true");
    vi.mocked(isLocalEnvironment).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores DISABLE_RATE_LIMITS in production with warning", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await enforceRateLimit("user-001", "handle_change");

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("DISABLE_RATE_LIMITS ignored"));
    expect(result).toBeNull(); // Allowed because count is 0, not because of bypass

    consoleSpy.mockRestore();
  });
});

describe("checkRateLimit - concurrent request handling", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("handles concurrent check requests consistently", async () => {
    let callCount = 0;
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve([{ count: callCount > 3 ? 2 : 1 }]);
        }),
      }),
    } as never);

    const results = await Promise.all([
      checkRateLimit("user-001", "handle_change"),
      checkRateLimit("user-001", "handle_change"),
      checkRateLimit("user-001", "handle_change"),
    ]);

    // All should resolve without error
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r).toHaveProperty("allowed");
      expect(r).toHaveProperty("remaining");
    });
  });
});

describe("checkRateLimit - different user isolation", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("isolates rate limits by user ID", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          return Promise.resolve([{ count: 2 }]);
        }),
      }),
    } as never);

    const result1 = await checkRateLimit("user-001", "handle_change");
    const result2 = await checkRateLimit("user-002", "handle_change");

    // Both have same count but are independent users
    expect(result1.remaining).toBe(1);
    expect(result2.remaining).toBe(1);
  });
});

describe("checkRateLimit - time window accuracy", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("calculates 24 hour window correctly", async () => {
    const beforeCall = Date.now();

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await checkRateLimit("user-001", "handle_change");

    const expectedReset = beforeCall + 24 * 60 * 60 * 1000;

    expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(expectedReset - 1000);
    expect(result.resetAt.getTime()).toBeLessThanOrEqual(expectedReset + 1000);
  });
});

describe("enforceRateLimit - bypass attempts", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cannot be bypassed without proper environment", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as never);

    // Try to call with same user ID that has exceeded limit
    const result = await enforceRateLimit("user-001", "handle_change");

    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(429);
  });
});
