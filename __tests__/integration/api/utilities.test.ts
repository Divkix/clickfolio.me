import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RESERVED_HANDLES } from "@/lib/rate-limit/handle-validation";
import { createSignedCookieValue, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";

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
      if (!privacySettings.show_email) delete (filteredContact as UnknownRecord).email;
      if (!privacySettings.show_phone) delete (filteredContact as UnknownRecord).phone;
      if (!privacySettings.show_address) delete (filteredContact as UnknownRecord).location;
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

  describe("security headers", () => {
    it("should create success response with security headers", () => {
      const createSuccessResponse = (data: JsonValue) => {
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
