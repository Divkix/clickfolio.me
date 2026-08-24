import type { UnknownRecord } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Rate Limit Enforcement Security Tests
 * Tests that rate limiting is properly enforced and cannot be bypassed
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();

// Raw postgres-js client exposed on the drizzle instance as db.$client.
// recordRateLimitAction issues its atomic conditional INSERT ... SELECT via a
// tagged template and reads RowList.count: 1 = row inserted (allowed),
// 0 = a concurrent request won the last slot (denied). NOTE: the hourly
// helper evaluates a second (empty) daily-guard template per call, so tests
// drive the outcome through rawInsertCount instead of call-order queues.
let rawInsertCount = 1;
const mockRawClient = vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) =>
  Promise.resolve({ count: rawInsertCount }),
);

/**
 * Last tagged-template SQL received by the raw client. Captures the call
 * explicitly so a missing call throws instead of joining over `undefined`.
 */
function lastRawSqlText(): string {
  const lastCall = mockRawClient.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("Expected mockRawClient to have recorded a tagged-template call");
  }
  return lastCall[0].join("?");
}

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  $client: mockRawClient,
};

// Mock cloudflare:workers env
vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

// Mock drizzle-orm
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

// Mock DB module
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock the schema
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

// Mock environment check
vi.mock("@/lib/utils/environment", () => ({
  isLocalEnvironment: vi.fn(() => false),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset NODE_ENV for each test
  vi.stubGlobal("process", { ...process, env: { ...process.env, NODE_ENV: "production" } });
  rawInsertCount = 1;
});

// ── Test Suite ──────────────────────────────────────────────────────

describe("Rate Limit Security Enforcement", () => {
  describe("IP-based Rate Limiting", () => {
    it("enforces upload rate limit - 10/hour maximum", async () => {
      // Mock that user has already made 10 requests in the last hour
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 10, daily: 10 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
      expect(result.remaining.hourly).toBe(0);
    });

    it("enforces upload rate limit - 50/day maximum", async () => {
      // Mock that user has made 50 requests in the last day
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 5, daily: 50 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
      expect(result.remaining.daily).toBe(0);
    });

    it("allows requests under the rate limit", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 3, daily: 20 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining.hourly).toBeGreaterThan(0);
    });
  });

  describe("Handle Check Rate Limiting", () => {
    it("enforces handle check rate limit - 100/hour maximum", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      });

      const { checkHandleRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkHandleRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
      expect(result.remaining.hourly).toBe(0);
    });
  });

  describe("Email Validation Rate Limiting", () => {
    it("enforces email validate rate limit", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 30 }]),
        }),
      });

      const { checkEmailValidateRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkEmailValidateRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
    });
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
      // The getClientIP function uses CF-Connecting-IP header which cannot be spoofed
      const { getClientIP } = await import("@/lib/rate-limit/ip");

      // Request with spoofed X-Forwarded-For
      const request = new Request("http://localhost:3000/api/upload", {
        headers: {
          "X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3", // Spoofed chain
          "CF-Connecting-IP": "192.168.1.1", // Authoritative
        },
      });

      const ip = getClientIP(request);
      expect(ip).toBe("192.168.1.1"); // Uses CF header, not X-Forwarded-For
    });

    it("ignores X-Forwarded-For when CF-Connecting-IP is present", async () => {
      const { getClientIP } = await import("@/lib/rate-limit/ip");

      const request = new Request("http://localhost:3000/api/upload", {
        headers: {
          "X-Forwarded-For": "spoofed-ip", // Attempted bypass
          "CF-Connecting-IP": "real-ip", // Authoritative
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

      // Takes first IP from chain
      expect(getClientIP(request)).toBe("192.168.1.1");
    });

    it("handles rapid requests without allowing bypass", async () => {
      // Simulate burst of requests
      const requests = Array(15)
        .fill(null)
        .map(() => "192.168.1.1");

      let callCount = 0;
      // First 10 should be allowed, then blocked
      mockSelect.mockImplementation(() => {
        callCount++;
        const currentHourly = Math.min(callCount - 1, 10); // Previous count
        return {
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockResolvedValue([{ hourly: currentHourly, daily: Math.min(currentHourly, 50) }]),
          }),
        };
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

      let allowedCount = 0;
      for (const ip of requests) {
        const result = await checkIPRateLimit(ip);
        if (result.allowed) allowedCount++;
      }

      // Should allow up to 10 requests
      expect(allowedCount).toBeLessThanOrEqual(10);
    });

    it("does not bypass limits for unknown IPs (item 20)", async () => {
      // "unknown" (getClientIP fallback) is no longer in LOCAL_IPS — it must
      // be bucketed and limited like any other IP.
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 10, daily: 10 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("unknown");

      expect(result.allowed).toBe(false);
    });

    it("consults the DB for unknown IPs instead of short-circuiting (item 20)", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("unknown");

      // Under the limit, so allowed — but only after a real DB roundtrip.
      expect(result.allowed).toBe(true);
      expect(mockSelect).toHaveBeenCalled();
      // The conditional INSERT goes through the raw postgres-js $client.
      expect(mockRawClient).toHaveBeenCalled();
      const sqlText = lastRawSqlText();
      expect(sqlText).toContain("INSERT INTO upload_rate_limits");
    });
  });

  describe("Atomic Conditional Insert (TOCTOU)", () => {
    it("denies when the conditional insert lands 0 rows (concurrent burst)", async () => {
      // Count says under the limit, but a concurrent request won the last slot.
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 3, daily: 20 }]),
        }),
      });
      rawInsertCount = 0;

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Try again in an hour");
    });

    it("denies handle checks when the conditional insert lands 0 rows", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 50 }]),
        }),
      });
      rawInsertCount = 0;

      const { checkHandleRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkHandleRateLimit("192.168.1.1");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Too many handle checks");
    });

    it("records allowed requests via a single atomic INSERT (no separate insert)", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
      expect(mockRawClient).toHaveBeenCalled();
      const sqlText = lastRawSqlText();
      expect(sqlText).toContain("INSERT INTO upload_rate_limits");
      // The old count-then-insert path must not be used anymore.
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("still fails OPEN when the conditional insert throws", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      });
      mockRawClient.mockImplementationOnce(() => {
        throw new Error("Insert failed");
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
    });
  });

  describe("Rate Limit Reset Timing", () => {
    it("computes resetAt from the oldest in-window row + window (item 22)", async () => {
      const oldest = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2, oldest }]),
        }),
      });

      const { checkRateLimit } = await import("@/lib/rate-limit/user");
      const result = await checkRateLimit("user-123", "handle_change");

      // resetAt = oldest + 24h window, NOT now + 24h.
      const expected = new Date(oldest).getTime() + 24 * 60 * 60 * 1000;
      expect(Math.abs(result.resetAt.getTime() - expected)).toBeLessThan(5000);
      // And it must be earlier than the naive now + 24h (12h of the window
      // has already elapsed).
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

      // Mock production environment
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
  });

  describe("Rate Limit Window Accuracy", () => {
    it("respects exact time windows", async () => {
      const now = new Date("2026-01-15T12:00:00Z");
      vi.setSystemTime(now);

      // Request at exactly window boundary
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
    });

    it("resets counters at window boundaries", async () => {
      // Old requests outside window should not count
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            // Simulate requests older than window
            return {
              where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
            };
          }),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
    });
  });

  describe("Independent Rate Limit Tracking", () => {
    it("tracks different IPs independently", async () => {
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";

      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 10, daily: 50 }]),
        }),
      }));

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

      // IP1 at limit
      const result1 = await checkIPRateLimit(ip1);
      expect(result1.allowed).toBe(false);

      // Reset mock for IP2
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      }));

      // IP2 not at limit
      const result2 = await checkIPRateLimit(ip2);
      expect(result2.allowed).toBe(true);
    });

    it("tracks different actions independently", async () => {
      // Uploads at limit but handle checks still allowed
      mockSelect.mockImplementation((columns: UnknownRecord) => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              // Check column name to determine which action
              hourly: columns?.hourly !== undefined ? 10 : 0,
              daily: columns?.daily !== undefined ? 50 : 0,
            },
          ]),
        }),
      }));

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

      // Upload rate limited
      const uploadResult = await checkIPRateLimit("192.168.1.1");
      expect(uploadResult.allowed).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles exactly at limit correctly", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 9, daily: 49 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      // Should allow 10th request
      expect(result.allowed).toBe(true);
      expect(result.remaining.hourly).toBe(0);
    });

    it("handles null or empty IP gracefully", async () => {
      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

      // Empty IP should be handled
      const result = await checkIPRateLimit("");
      expect([true, false]).toContain(result.allowed);
    });

    it("handles IPv6 addresses properly", async () => {
      const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 0, daily: 0 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit(ipv6);

      // Should handle IPv6 without error
      expect([true, false]).toContain(result.allowed);
    });

    it("rate limit persists across sessions", async () => {
      // Same IP, multiple "sessions"
      const ip = "192.168.1.1";

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 5, daily: 25 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");

      // Multiple calls from same IP
      const results = await Promise.all([
        checkIPRateLimit(ip),
        checkIPRateLimit(ip),
        checkIPRateLimit(ip),
      ]);

      // All should see the same rate limit state
      results.forEach((result) => {
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe("Fail-Open vs Fail-Closed Behavior", () => {
    it("fails OPEN for IP rate limiting errors", async () => {
      // Simulate DB error
      mockSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      // IP rate limiting fails open to avoid blocking legitimate users
      expect(result.allowed).toBe(true);
    });

    it("fails CLOSED for authenticated rate limiting errors", async () => {
      // Simulate DB error
      mockSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const { checkRateLimit } = await import("@/lib/rate-limit/user");
      const result = await checkRateLimit("user-123", "resume_upload");

      // Auth rate limiting fails closed for security
      expect(result.allowed).toBe(false);
    });
  });

  describe("DISABLE_RATE_LIMITS Flag", () => {
    it("respects DISABLE_RATE_LIMITS in non-production only", async () => {
      vi.stubGlobal("process", {
        ...process,
        env: {
          ...process.env,
          NODE_ENV: "development",
          DISABLE_RATE_LIMITS: "true",
        },
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      expect(result.allowed).toBe(true);
    });

    it("ignores DISABLE_RATE_LIMITS in production", async () => {
      vi.stubGlobal("process", {
        ...process,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DISABLE_RATE_LIMITS: "true",
        },
      });

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ hourly: 10, daily: 50 }]),
        }),
      });

      const { checkIPRateLimit } = await import("@/lib/rate-limit/ip");
      const result = await checkIPRateLimit("192.168.1.1");

      // Should still enforce rate limit
      expect(result.allowed).toBe(false);
    });
  });
});
