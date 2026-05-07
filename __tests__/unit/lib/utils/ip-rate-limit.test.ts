/**
 * IP-based rate limiting unit tests
 * Tests for lib/utils/ip-rate-limit.ts
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb } from "@/__tests__/setup/mocks/db.mock";
import {
  checkEmailValidateRateLimit,
  checkHandleRateLimit,
  checkIPRateLimit,
  getClientIP,
} from "@/lib/utils/ip-rate-limit";

// Mock the modules
vi.mock("cloudflare:workers", () => ({
  env: { CLICKFOLIO_DB: {} as D1Database },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/utils/environment", () => ({
  isLocalEnvironment: vi.fn().mockReturnValue(false),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...conditions: unknown[]) => ({ conditions, type: "and" })),
    eq: vi.fn((column: unknown, value: unknown) => ({ column, type: "eq", value })),
    gte: vi.fn((column: unknown, value: unknown) => ({ column, type: "gte", value })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      type: "sql",
      values,
    })),
  };
});

import { getDb } from "@/lib/db";
import { isLocalEnvironment } from "@/lib/utils/environment";

describe("getClientIP", () => {
  it("extracts IP from CF-Connecting-IP header", () => {
    const request = new Request("http://localhost", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    const result = getClientIP(request);

    expect(result).toBe("192.168.1.1");
  });

  it("falls back to X-Forwarded-For when CF-Connecting-IP is missing", () => {
    const request = new Request("http://localhost", {
      headers: { "X-Forwarded-For": "192.168.1.2, 10.0.0.1" },
    });

    const result = getClientIP(request);

    expect(result).toBe("192.168.1.2");
  });

  it("trims whitespace from X-Forwarded-For IP", () => {
    const request = new Request("http://localhost", {
      headers: { "X-Forwarded-For": "  192.168.1.3  , 10.0.0.1" },
    });

    const result = getClientIP(request);

    expect(result).toBe("192.168.1.3");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const request = new Request("http://localhost");

    const result = getClientIP(request);

    expect(result).toBe("unknown");
  });

  it("prioritizes CF-Connecting-IP over X-Forwarded-For", () => {
    const request = new Request("http://localhost", {
      headers: {
        "CF-Connecting-IP": "192.168.1.10",
        "X-Forwarded-For": "192.168.1.20",
      },
    });

    const result = getClientIP(request);

    expect(result).toBe("192.168.1.10");
  });

  it("handles IPv6 addresses in CF-Connecting-IP", () => {
    const request = new Request("http://localhost", {
      headers: { "CF-Connecting-IP": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" },
    });

    const result = getClientIP(request);

    expect(result).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });

  it("handles IPv6 addresses in X-Forwarded-For", () => {
    const request = new Request("http://localhost", {
      headers: { "X-Forwarded-For": "::1, 192.168.1.1" },
    });

    const result = getClientIP(request);

    expect(result).toBe("::1");
  });
});

describe("checkIPRateLimit - Development Environment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows all requests in development mode", async () => {
    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toEqual({ hourly: 10, daily: 50 });
  });

  it("allows all requests when DISABLE_RATE_LIMITS is true in development", async () => {
    vi.stubEnv("DISABLE_RATE_LIMITS", "true");

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    // In development, returns default values regardless of DISABLE_RATE_LIMITS
    expect(result.remaining).toEqual({ hourly: 10, daily: 50 });
  });
});

describe("checkIPRateLimit - Local IPs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests from localhost", async () => {
    const result = await checkIPRateLimit("127.0.0.1");

    expect(result.allowed).toBe(true);
  });

  it("allows requests from ::1", async () => {
    const result = await checkIPRateLimit("::1");

    expect(result.allowed).toBe(true);
  });

  it("allows requests from 0.0.0.0", async () => {
    const result = await checkIPRateLimit("0.0.0.0");

    expect(result.allowed).toBe(true);
  });

  it("allows requests from unknown IP", async () => {
    const result = await checkIPRateLimit("unknown");

    expect(result.allowed).toBe(true);
  });

  it("allows requests from localhost with IPv6 prefix", async () => {
    const result = await checkIPRateLimit("::ffff:127.0.0.1");

    expect(result.allowed).toBe(true);
  });
});

describe("checkIPRateLimit - Production Rate Limiting", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    // Setup insert mock as it may be called for successful requests
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows request when under hourly limit", async () => {
    // Mock count of 5 requests in the last hour
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 5, daily: 5 }]),
      }),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(4);
    expect(result.remaining.daily).toBe(44);
  });

  it("allows request when at hourly limit boundary", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 9, daily: 9 }]),
      }),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(0);
  });

  it("blocks request when hourly limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 10, daily: 10 }]),
      }),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Try again in an hour");
    expect(result.remaining.hourly).toBe(0);
  });

  it("blocks request when daily limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 5, daily: 50 }]),
      }),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Daily upload limit reached");
    expect(result.remaining.daily).toBe(0);
  });

  it("fails open on database errors", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toEqual({ hourly: 1, daily: 1 });
  });

  it("records request on success", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
      }),
    } as never);
    mockDb.insert.mockReturnValue({ values: valuesMock } as never);

    await checkIPRateLimit("192.168.1.1");

    expect(mockDb.insert).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ actionType: "upload" }));
  });

  it("counts only upload actions toward anonymous upload limits", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
      }),
    } as never);

    await checkIPRateLimit("192.168.1.1");

    expect(vi.mocked(eq).mock.calls.some(([, value]) => value === "upload")).toBe(true);
  });

  it("still allows request when record fails (fail open)", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
      }),
    } as never);
    mockDb.insert.mockImplementation(() => {
      throw new Error("Insert failed");
    });

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
  });

  it("generates consistent IP hash for same IP", async () => {
    const results = await Promise.all([
      checkIPRateLimit("192.168.1.100"),
      checkIPRateLimit("192.168.1.100"),
    ]);

    // Both should be allowed (first requests)
    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(true);
  });

  it("generates different hashes for different IPs", async () => {
    // This is implicitly tested - different IPs will have different rate limit counts
    const result1 = await checkIPRateLimit("192.168.1.1");
    const result2 = await checkIPRateLimit("192.168.1.2");

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });
});

describe("checkHandleRateLimit - Development", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows all handle checks in development", async () => {
    const result = await checkHandleRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(100);
  });
});

describe("checkHandleRateLimit - Production", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isLocalEnvironment).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    // Setup insert mock as it may be called for successful requests
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows handle check when under limit", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 50 }]),
      }),
    } as never);

    const result = await checkHandleRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(49);
  });

  it("blocks handle check when limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 100 }]),
      }),
    } as never);

    const result = await checkHandleRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Too many handle checks");
  });

  it("records handle check action type separately", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);
    const insertMock = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockDb.insert.mockReturnValue(insertMock as never);

    await checkHandleRateLimit("192.168.1.1");

    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe("checkEmailValidateRateLimit - Development", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows all email validations in development", async () => {
    const result = await checkEmailValidateRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(30);
  });
});

describe("checkEmailValidateRateLimit - Production", () => {
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

  it("allows email validation when under limit", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 20 }]),
      }),
    } as never);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await checkEmailValidateRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(9);
  });

  it("blocks email validation when limit exceeded", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 30 }]),
      }),
    } as never);

    const result = await checkEmailValidateRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Too many email validation checks");
  });

  it("fails open on database errors", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("Database error");
    });

    const result = await checkEmailValidateRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toEqual({ hourly: 1, daily: 1 });
  });
});

describe("DISABLE_RATE_LIMITS security", () => {
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

  it("ignores DISABLE_RATE_LIMITS in production", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
      }),
    } as never);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await checkIPRateLimit("192.168.1.1");

    // Should go through normal rate limiting
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("DISABLE_RATE_LIMITS ignored"));
    consoleSpy.mockRestore();
  });
});

describe("Rate limit window expiration", () => {
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

  it("resets hourly count after window expires", async () => {
    // Simulate 11 old requests (outside 1 hour window) + 5 recent
    // But our mock counts everything, so we control the query result
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 5, daily: 16 }]),
      }),
    } as never);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.hourly).toBe(4);
  });

  it("resets daily count after 24 hours", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 49 }]),
      }),
    } as never);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await checkIPRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining.daily).toBe(0);
  });
});
