/**
 * Tests for password strength validation and HIBP breach checking.
 * Covers zxcvbn-based scoring, user context penalties, feedback, crack-time estimates,
 * and Have I Been Pwned API integration with fail-open behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkBreached } from "@/lib/password/hibp";
import { checkPasswordStrength, MINIMUM_SCORE } from "@/lib/password/strength";

describe("password strength validation", () => {
  describe("checkPasswordStrength", () => {
    it("returns score 0 for extremely weak passwords", async () => {
      const result = await checkPasswordStrength("12345678");
      expect(result.score).toBe(0);
      expect(result.isAcceptable).toBe(false);
    });

    it("returns score 1 for weak passwords", async () => {
      const result = await checkPasswordStrength("password123");
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.isAcceptable).toBe(false);
    });

    it("returns score >= 2 for acceptable passwords", async () => {
      // "Tr0ub4dor&3" is the classic XKCD example of a "medium" password
      const result = await checkPasswordStrength("Tr0ub4dor&3");
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.isAcceptable).toBe(true);
    });

    it("returns score 3-4 for strong passwords", async () => {
      const result = await checkPasswordStrength("correct horse battery staple!");
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.isAcceptable).toBe(true);
    });

    it("penalizes passwords containing user email", async () => {
      const email = "johndoe@example.com";
      const passwordWithEmail = "johndoe_password123";

      // Without context
      const resultWithoutContext = await checkPasswordStrength(passwordWithEmail);

      // With user context (email)
      const resultWithContext = await checkPasswordStrength(passwordWithEmail, [email]);

      // Score should be lower when password contains part of email
      expect(resultWithContext.score).toBeLessThanOrEqual(resultWithoutContext.score);
    });

    it("penalizes passwords containing user name", async () => {
      const name = "John Doe";
      const passwordWithName = "john_secure_2024";

      // Without context
      const resultWithoutContext = await checkPasswordStrength(passwordWithName);

      // With user context (name)
      const resultWithContext = await checkPasswordStrength(passwordWithName, [name]);

      // Score should be lower or equal when password contains the name
      expect(resultWithContext.score).toBeLessThanOrEqual(resultWithoutContext.score);
    });

    it("provides feedback for weak passwords", async () => {
      const result = await checkPasswordStrength("password");
      expect(result.feedback).toBeDefined();
      expect(result.feedback.warning || result.feedback.suggestions.length).toBeTruthy();
    });

    it("provides crack time estimate", async () => {
      const result = await checkPasswordStrength("somepassword");
      expect(result.crackTimeDisplay).toBeDefined();
      expect(typeof result.crackTimeDisplay).toBe("string");
    });

    it("handles empty password gracefully", async () => {
      const result = await checkPasswordStrength("");
      expect(result.score).toBe(0);
      expect(result.isAcceptable).toBe(false);
    });

    it("handles very long passwords", async () => {
      const longPassword = "a".repeat(200);
      const result = await checkPasswordStrength(longPassword);
      // Should not throw, result depends on entropy
      expect(typeof result.score).toBe("number");
    });
  });

  describe("MINIMUM_SCORE", () => {
    it("is set to 2", () => {
      expect(MINIMUM_SCORE).toBe(2);
    });
  });

  describe("isAcceptable logic", () => {
    it("returns true when score equals MINIMUM_SCORE", async () => {
      // Need to find a password that scores exactly 2
      // This is a probabilistic test, using a known medium-strength password
      const result = await checkPasswordStrength("simple_pass!");
      // The test is about the logic: isAcceptable = score >= MINIMUM_SCORE
      expect(result.isAcceptable).toBe(result.score >= MINIMUM_SCORE);
    });

    it("returns false when score is below MINIMUM_SCORE", async () => {
      const result = await checkPasswordStrength("abc123");
      expect(result.score).toBeLessThan(MINIMUM_SCORE);
      expect(result.isAcceptable).toBe(false);
    });
  });
});

describe("HIBP breach checking", () => {
  // Note: These tests mock the fetch API to avoid actual network calls
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("detects breached password", async () => {
    // Mock the HIBP API response for a breached password
    // The HIBP API returns a list of hash suffixes and counts
    // For "password", SHA1 = 5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8
    // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    const mockResponse = `
1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493
0018A45C4D1DEF81644B54AB7F969B88D65:1
`.trim();

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => mockResponse,
    }) as unknown as typeof fetch;

    const result = await checkBreached("password");
    expect(result.isBreached).toBe(true);
    expect(result.count).toBe(3861493);
  });

  it("returns not breached for clean password", async () => {
    // Mock response without matching suffix
    const mockResponse = `
0000000000000000000000000000000000000:1
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2
`.trim();

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => mockResponse,
    }) as unknown as typeof fetch;

    const result = await checkBreached("verylonganduniquep@ssw0rd123!");
    expect(result.isBreached).toBe(false);
    expect(result.count).toBe(0);
  });

  it("fails open on network error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

    const result = await checkBreached("anypassword");
    // Should fail open - not block registration on network issues
    expect(result.isBreached).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toBeDefined();
  });

  it("fails open on API error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    }) as unknown as typeof fetch;

    const result = await checkBreached("anypassword");
    expect(result.isBreached).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toBeDefined();
  });
});
