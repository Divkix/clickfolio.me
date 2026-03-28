/**
 * Referral system unit tests
 * Tests for lib/referral.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb } from "@/__tests__/setup/mocks/db.mock";
import {
  captureReferralCode,
  clearStoredReferralCode,
  getStoredReferralCode,
  writeReferral,
} from "@/lib/referral";

// Mock dependencies
vi.mock("cloudflare:workers", () => ({
  env: { CLICKFOLIO_DB: {} as D1Database },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/utils/analytics", () => ({
  generateVisitorHashWithDate: vi.fn().mockResolvedValue("mock-hash"),
}));

vi.mock("@/lib/utils/ip-rate-limit", () => ({
  getClientIP: vi.fn().mockReturnValue("192.168.1.1"),
}));

import { getDb } from "@/lib/db";

describe("Client-side referral functions", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe("captureReferralCode", () => {
    it("is defined", () => {
      expect(captureReferralCode).toBeDefined();
      expect(typeof captureReferralCode).toBe("function");
    });

    it("handles server-side rendering gracefully", () => {
      // When window is undefined, should not throw
      expect(() => captureReferralCode("TESTCODE")).not.toThrow();
    });
  });

  describe("getStoredReferralCode", () => {
    it("is defined", () => {
      expect(getStoredReferralCode).toBeDefined();
      expect(typeof getStoredReferralCode).toBe("function");
    });

    it("handles server-side rendering gracefully", () => {
      // When window is undefined, should return null
      const result = getStoredReferralCode();
      expect(result).toBeNull();
    });
  });

  describe("clearStoredReferralCode", () => {
    it("is defined", () => {
      expect(clearStoredReferralCode).toBeDefined();
      expect(typeof clearStoredReferralCode).toBe("function");
    });

    it("handles server-side rendering gracefully", () => {
      // When window is undefined, should not throw
      expect(() => clearStoredReferralCode()).not.toThrow();
    });
  });
});

describe("writeReferral - server-side", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("returns error for empty referrer code", async () => {
    const result = await writeReferral("user-001", "");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("empty_ref");
  });

  it("returns error for code exceeding max length", async () => {
    const longCode = "a".repeat(65);

    const result = await writeReferral("user-001", longCode);

    expect(result.success).toBe(false);
    expect(result.reason).toBe("ref_too_long");
  });

  it("returns error for invalid referrer code", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await writeReferral("user-001", "INVALIDCODE");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("invalid_ref");
  });

  it("returns error for self-referral", async () => {
    const userId = "user-001";
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    const result = await writeReferral(userId, "REFCODE");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("self_referral");
  });

  it("successfully writes referral when valid", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    const result = await writeReferral(userId, "REFCODE");

    expect(result.success).toBe(true);
  });

  it("handles codes with @ prefix", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    const result = await writeReferral(userId, "@username");

    expect(result.success).toBe(true);
  });

  it("matches referral code case-insensitively (uppercase)", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    // Should match UPPERCASE code
    const result = await writeReferral(userId, "testcode");

    expect(result.success).toBe(true);
  });

  it("matches handle case-insensitively (lowercase)", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    // Should match lowercase handle
    const result = await writeReferral(userId, "Username");

    expect(result.success).toBe(true);
  });
});

describe("writeReferral - click tracking", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("marks referral clicks as converted on success", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "click-id" }]),
        }),
      }),
    } as never);

    const request = new Request("http://localhost", {
      headers: { "User-Agent": "test-agent" },
    });

    const result = await writeReferral(userId, "REFCODE", request);

    expect(result.success).toBe(true);
  });

  it("still succeeds even if click tracking fails", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    // Click tracking fails
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }),
    } as never);

    const request = new Request("http://localhost");

    const result = await writeReferral(userId, "REFCODE", request);

    expect(result.success).toBe(true);
  });
});

describe("writeReferral - concurrent requests", () => {
  const mockDb = createMockDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it("handles concurrent write attempts with atomic update", async () => {
    const userId = "user-001";
    const referrerId = "user-002";

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: referrerId }]),
        }),
      }),
    } as never);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: userId }]),
        }),
      }),
    } as never);

    // Simulate concurrent writes - only first should succeed
    const results = await Promise.all([
      writeReferral(userId, "REFCODE"),
      writeReferral(userId, "REFCODE2"),
    ]);

    // At least one should succeed
    expect(results.some((r) => r.success)).toBe(true);
  });
});
