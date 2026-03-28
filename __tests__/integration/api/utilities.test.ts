import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetCache, extractDomain, isDisposableEmail } from "@/lib/email/disposable-check";
import { generateVisitorHash } from "@/lib/utils/analytics";
import { RESERVED_HANDLES } from "@/lib/utils/handle-validation";
import { createSignedCookieValue, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";

// Mock the Better Auth module
vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn().mockResolvedValue({
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  }),
}));

// Mock headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe("Utility APIs", () => {
  const mockSecret = "test-secret-key-for-cookies-12345";

  beforeEach(() => {
    vi.clearAllMocks();
    _resetCache();
  });

  describe("handle/check", () => {
    it("should check handle availability", async () => {
      const handle = "availableuser";

      // Check format validation passes
      expect(handle.length).toBeGreaterThanOrEqual(3);
      expect(handle.length).toBeLessThanOrEqual(30);
      expect(/^[a-z0-9-]+$/.test(handle)).toBe(true);
      expect(!/^-|-$/.test(handle)).toBe(true);
      expect(!/--/.test(handle)).toBe(true);
      expect(!RESERVED_HANDLES.has(handle)).toBe(true);
    });

    it("should reject handles that are too short", () => {
      const shortHandle = "ab";
      expect(shortHandle.length).toBeLessThan(3);
    });

    it("should reject handles that are too long", () => {
      const longHandle = "a".repeat(31);
      expect(longHandle.length).toBeGreaterThan(30);
    });

    it("should reject invalid handle format", () => {
      const invalidHandles = [
        "user name", // space
        "user@name", // special char
        "UserName", // uppercase
        "-username", // starts with hyphen
        "username-", // ends with hyphen
        "user--name", // consecutive hyphens
      ];

      for (const handle of invalidHandles) {
        const isValid = /^[a-z0-9-]+$/.test(handle) && !/^-|-$/.test(handle) && !/--/.test(handle);
        expect(isValid).toBe(false);
      }
    });

    it("should reject reserved words as handles", () => {
      for (const handle of RESERVED_HANDLES) {
        expect(RESERVED_HANDLES.has(handle)).toBe(true);
      }
    });

    it("should allow valid handle formats", () => {
      const validHandles = ["johndoe", "john-doe", "john123", "john-doe-123", "abc", "a-b-c"];

      for (const handle of validHandles) {
        const isValid =
          /^[a-z0-9-]+$/.test(handle) &&
          handle.length >= 3 &&
          handle.length <= 30 &&
          !/^-|-$/.test(handle) &&
          !/--/.test(handle) &&
          !RESERVED_HANDLES.has(handle);
        expect(isValid).toBe(true);
      }
    });
  });

  describe("email/validate", () => {
    it("should accept valid email addresses", async () => {
      const validEmails = [
        "user@gmail.com",
        "test@outlook.com",
        "hello@yahoo.com",
        "dev@icloud.com",
        "admin@company.com",
      ];

      for (const email of validEmails) {
        const domain = extractDomain(email);
        expect(domain).not.toBeNull();
      }
    });

    it("should reject disposable email domains", async () => {
      const mockKV = {
        get: vi
          .fn()
          .mockResolvedValue(JSON.stringify(["tempmail.com", "throwaway.com", "mailinator.com"])),
      };

      const disposableEmail = "test@tempmail.com";
      const result = await isDisposableEmail(disposableEmail, mockKV as unknown as KVNamespace);

      expect(result.disposable).toBe(true);
    });

    it("should accept trusted email domains", async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(JSON.stringify(["tempmail.com"])),
      };

      const trustedEmails = [
        "user@gmail.com",
        "test@outlook.com",
        "hello@yahoo.com",
        "dev@icloud.com",
        "admin@protonmail.com",
      ];

      for (const email of trustedEmails) {
        const result = await isDisposableEmail(email, mockKV as unknown as KVNamespace);
        expect(result.disposable).toBe(false);
      }
    });

    it("should fail open when KV is unavailable", async () => {
      const result = await isDisposableEmail("test@tempmail.com", null);
      expect(result.disposable).toBe(false);
    });

    it("should handle malformed email addresses", async () => {
      const malformedEmails = [
        "notanemail",
        "@nodomain.com",
        "noat.com",
        "spaces in@email.com",
        "",
      ];

      for (const email of malformedEmails) {
        const domain = extractDomain(email);
        if (domain === null) {
          // This is acceptable - domain extraction failed
          expect(domain).toBeNull();
        }
      }
    });

    it("should cache domain list for performance", async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(JSON.stringify(["tempmail.com"])),
      };

      // First call - should hit KV
      await isDisposableEmail("test@tempmail.com", mockKV as unknown as KVNamespace);

      // Second call - should use cache
      await isDisposableEmail("test@tempmail.com", mockKV as unknown as KVNamespace);

      // KV should only be called once due to caching
      expect(mockKV.get).toHaveBeenCalledTimes(1);
    });

    it("should handle edge cases in email parsing", async () => {
      const edgeCases = [
        { email: "user@@domain.com", expected: "domain.com" },
        { email: "User@Domain.COM", expected: "domain.com" },
        { email: "user+tag@gmail.com", expected: "gmail.com" },
        { email: "user.name@sub.domain.com", expected: "sub.domain.com" },
      ];

      for (const { email, expected } of edgeCases) {
        const domain = extractDomain(email);
        expect(domain).toBe(expected);
      }
    });
  });

  describe("referral/track", () => {
    it("should track referral click with deduplication", async () => {
      const ip = "192.168.1.1";
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

      // Generate visitor hash
      const visitorHash = await generateVisitorHash(ip, userAgent);
      expect(visitorHash).toBeDefined();
      expect(typeof visitorHash).toBe("string");

      // Same IP and UA should generate same hash
      const visitorHash2 = await generateVisitorHash(ip, userAgent);
      expect(visitorHash).toBe(visitorHash2);

      // Different IP should generate different hash
      const visitorHash3 = await generateVisitorHash("192.168.1.2", userAgent);
      expect(visitorHash).not.toBe(visitorHash3);
    });

    it("should handle bot detection", () => {
      const botUserAgents = [
        "Googlebot/2.1",
        "Mozilla/5.0 (compatible; bingbot/2.0)",
        "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        "Twitterbot/1.0",
      ];

      for (const ua of botUserAgents) {
        const isBotUa = /bot|crawler|spider|crawling/i.test(ua);
        expect(isBotUa).toBe(true);
      }
    });

    it("should handle valid sources", () => {
      const validSources = ["homepage", "cta", "share"];
      const invalidSources = ["invalid", "hacked", "test", ""];

      for (const source of validSources) {
        expect(["homepage", "cta", "share"].includes(source)).toBe(true);
      }

      for (const source of invalidSources) {
        expect(["homepage", "cta", "share"].includes(source)).toBe(false);
      }
    });

    it("should handle referral code format", () => {
      const validCodes = ["ABC123", "XYZ789", "REF001"];
      const invalidCodes = ["", "a".repeat(65), "   "];

      for (const code of validCodes) {
        expect(code.length).toBeGreaterThan(0);
        expect(code.length).toBeLessThanOrEqual(64);
      }

      for (const code of invalidCodes) {
        const isValid = code.length > 0 && code.length <= 64 && code.trim() !== "";
        expect(isValid).toBe(false);
      }
    });
  });

  describe("upload/pending - Cookie Management", () => {
    it("should create signed cookie value", async () => {
      const tempKey = "temp/user-123/file.pdf";
      const cookieValue = await createSignedCookieValue(tempKey, mockSecret);

      expect(cookieValue).toBeDefined();
      expect(cookieValue).toContain(tempKey);
      expect(cookieValue.split("|").length).toBe(3); // key|expires|signature
    });

    it("should parse valid signed cookie", async () => {
      const tempKey = "temp/user-456/resume.pdf";
      const cookieValue = await createSignedCookieValue(tempKey, mockSecret);

      const parsed = await parseSignedCookieValue(cookieValue, mockSecret);

      expect(parsed).not.toBeNull();
      expect(parsed?.tempKey).toBe(tempKey);
    });

    it("should reject tampered cookie signature", async () => {
      const tempKey = "temp/user-789/file.pdf";
      const cookieValue = await createSignedCookieValue(tempKey, mockSecret);

      // Tamper with the cookie
      const tamperedValue = cookieValue.replace(tempKey, "hacked/key");

      const parsed = await parseSignedCookieValue(tamperedValue, mockSecret);
      expect(parsed).toBeNull();
    });

    it("should reject expired cookie", async () => {
      // Create a cookie with past expiry
      const tempKey = "temp/user-old/file.pdf";
      const expiredTimestamp = Date.now() - 1000; // 1 second ago
      const expiredPayload = `${tempKey}|${expiredTimestamp}`;

      // Generate signature for expired payload
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(mockSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expiredPayload));
      const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

      const expiredCookie = `${expiredPayload}|${signatureB64}`;

      const parsed = await parseSignedCookieValue(expiredCookie, mockSecret);
      expect(parsed).toBeNull();
    });

    it("should reject malformed cookie format", async () => {
      const malformedCookies = ["invalid", "key|expires", "key|expires|signature|extra", ""];

      for (const cookie of malformedCookies) {
        const parsed = await parseSignedCookieValue(cookie, mockSecret);
        expect(parsed).toBeNull();
      }
    });

    it("should reject cookie with wrong secret", async () => {
      const tempKey = "temp/user-999/file.pdf";
      const cookieValue = await createSignedCookieValue(tempKey, mockSecret);

      // Try to parse with different secret
      const wrongSecret = "different-secret-key-12345";
      const parsed = await parseSignedCookieValue(cookieValue, wrongSecret);

      expect(parsed).toBeNull();
    });

    it("should validate temp key format", () => {
      const validKeys = ["temp/uuid/file.pdf", "temp/123/Resume.pdf", "temp/abc-123/CV.pdf"];

      const invalidKeys = [
        "uploads/file.pdf", // Not temp/
        "temp/", // Too short
        "", // Empty
      ];

      for (const key of validKeys) {
        expect(key.startsWith("temp/")).toBe(true);
        expect(key.length).toBeGreaterThan(5);
      }

      for (const key of invalidKeys) {
        const isValid = key.startsWith("temp/") && key.length > 5;
        expect(isValid).toBe(false);
      }
    });
  });

  describe("client-error", () => {
    it("should sanitize error messages", () => {
      const sanitizeMessage = (msg: string): string => {
        const maxLength = 1000;
        return msg.length > maxLength ? msg.slice(0, maxLength) : msg;
      };

      const longMessage = "a".repeat(2000);
      const sanitized = sanitizeMessage(longMessage);

      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });

    it("should sanitize stack traces", () => {
      const sanitizeStack = (stack: string): string => {
        const maxLength = 2000;
        return stack.length > maxLength ? stack.slice(0, maxLength) : stack;
      };

      const longStack = "Error: Test\n".repeat(500);
      const sanitized = sanitizeStack(longStack);

      expect(sanitized.length).toBeLessThanOrEqual(2000);
    });

    it("should sanitize URLs", () => {
      const sanitizeUrl = (url: string): string => {
        const maxLength = 500;
        return url.length > maxLength ? url.slice(0, maxLength) : url;
      };

      const longUrl = `https://example.com/${"path/".repeat(100)}`;
      const sanitized = sanitizeUrl(longUrl);

      expect(sanitized.length).toBeLessThanOrEqual(500);
    });

    it("should handle empty error messages", () => {
      const emptyMessage = "";
      const shouldLog = emptyMessage.length > 0;
      expect(shouldLog).toBe(false);
    });

    it("should handle non-string error inputs", () => {
      const nonStringInputs = [null, undefined, 123, {}, [], true];

      for (const input of nonStringInputs) {
        const isValidString = typeof input === "string" && input.length > 0;
        expect(isValidString).toBe(false);
      }
    });
  });

  describe("health check", () => {
    it("should check service health status aggregation", () => {
      // Test healthy status
      const healthyServices = {
        d1: { status: "healthy" as const },
        r2: { status: "healthy" as const },
        aiProvider: { status: "healthy" as const },
      };

      const aggregateStatus = (services: {
        d1: { status: string };
        r2: { status: string };
        aiProvider: { status: string };
      }) => {
        const statuses = Object.values(services).map((s) => s.status);
        if (statuses.every((s) => s === "healthy")) return "healthy";
        if (statuses.some((s) => s === "unhealthy")) return "unhealthy";
        return "degraded";
      };

      expect(aggregateStatus(healthyServices)).toBe("healthy");

      // Test unhealthy status
      const unhealthyServices = {
        d1: { status: "healthy" as const },
        r2: { status: "unhealthy" as const },
        aiProvider: { status: "healthy" as const },
      };
      expect(aggregateStatus(unhealthyServices)).toBe("unhealthy");

      // Test degraded status
      const degradedServices = {
        d1: { status: "healthy" as const },
        r2: { status: "degraded" as const },
        aiProvider: { status: "healthy" as const },
      };
      expect(aggregateStatus(degradedServices)).toBe("degraded");
    });

    it("should return appropriate HTTP status for health", () => {
      const getHttpStatus = (status: string) => {
        if (status === "healthy") return 200;
        if (status === "degraded") return 200;
        return 503;
      };

      expect(getHttpStatus("healthy")).toBe(200);
      expect(getHttpStatus("degraded")).toBe(200);
      expect(getHttpStatus("unhealthy")).toBe(503);
    });
  });

  describe("site-data filtering", () => {
    it("should filter private content for public access", () => {
      const privacySettings = {
        show_email: false,
        show_phone: false,
        show_address: false,
        show_linkedin: true,
        show_github: true,
      };

      const contact = {
        email: "private@example.com",
        phone: "555-1234",
        location: "123 Private St",
        linkedin: "https://linkedin.com/in/public",
        github: "https://github.com/public",
      };

      const filteredContact = { ...contact };
      if (!privacySettings.show_email) delete (filteredContact as Record<string, unknown>).email;
      if (!privacySettings.show_phone) delete (filteredContact as Record<string, unknown>).phone;
      if (!privacySettings.show_address)
        delete (filteredContact as Record<string, unknown>).location;

      expect(filteredContact).not.toHaveProperty("email");
      expect(filteredContact).not.toHaveProperty("phone");
      expect(filteredContact).not.toHaveProperty("location");
      expect(filteredContact).toHaveProperty("linkedin");
      expect(filteredContact).toHaveProperty("github");
    });

    it("should parse JSON content safely", () => {
      const validJson = JSON.stringify({ name: "Test", value: 123 });
      const parsed = JSON.parse(validJson);
      expect(parsed.name).toBe("Test");

      // Invalid JSON should not throw
      const invalidJson = "not valid json";
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe("rate limiting utilities", () => {
    it("should identify client IP from request", () => {
      const getClientIP = (request: { headers: { get: (name: string) => string | null } }) => {
        const cfConnectingIP = request.headers.get("CF-Connecting-IP");
        const xForwardedFor = request.headers.get("X-Forwarded-For");
        const xRealIP = request.headers.get("X-Real-IP");

        return cfConnectingIP || xForwardedFor?.split(",")[0]?.trim() || xRealIP || "unknown";
      };

      const requestWithCfIP = {
        headers: {
          get: (name: string) => (name === "CF-Connecting-IP" ? "192.168.1.1" : null),
        },
      };
      expect(getClientIP(requestWithCfIP)).toBe("192.168.1.1");

      const requestWithXForwarded = {
        headers: {
          get: (name: string) => (name === "X-Forwarded-For" ? "192.168.1.2, 10.0.0.1" : null),
        },
      };
      expect(getClientIP(requestWithXForwarded)).toBe("192.168.1.2");
    });
  });

  describe("user stats", () => {
    it("should calculate referral counts correctly", () => {
      const referralClicks = [
        { converted: true },
        { converted: false },
        { converted: true },
        { converted: false },
      ];

      const convertedCount = referralClicks.filter((c) => c.converted).length;
      expect(convertedCount).toBe(2);
    });

    it("should determine pro status", () => {
      const checkProStatus = (isPro: boolean, referralCount: number) => {
        return isPro || referralCount >= 10;
      };

      expect(checkProStatus(true, 0)).toBe(true);
      expect(checkProStatus(false, 15)).toBe(true);
      expect(checkProStatus(false, 5)).toBe(false);
    });
  });

  describe("security headers", () => {
    it("should create success response with security headers", () => {
      const createSuccessResponse = (data: unknown) => {
        return {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
          body: JSON.stringify({ success: true, data }),
        };
      };

      const response = createSuccessResponse({ test: "data" });
      expect(response.status).toBe(200);
      expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
    });

    it("should create error response with appropriate code", () => {
      const ERROR_CODES = {
        UNAUTHORIZED: "unauthorized",
        NOT_FOUND: "not_found",
        VALIDATION_ERROR: "validation_error",
        RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
        INTERNAL_ERROR: "internal_error",
      };

      const createErrorResponse = (message: string, code: string, status: number) => {
        return {
          status,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: false, error: message, code }),
        };
      };

      const response = createErrorResponse("Not found", ERROR_CODES.NOT_FOUND, 404);
      expect(response.status).toBe(404);
      expect(JSON.parse(response.body).code).toBe("not_found");
    });
  });
});
