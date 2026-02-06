import { ofetch } from "ofetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/resend";

vi.mock("ofetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ofetch")>();
  return {
    ...actual,
    ofetch: vi.fn(),
  };
});

describe("email verification", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123456789");
    vi.stubEnv("BETTER_AUTH_URL", "https://clickfolio.me");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe("sendVerificationEmail", () => {
    it("sends verification email successfully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }) as unknown as typeof fetch;

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "Test User",
      });

      expect(result.success).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_test_123456789",
          }),
        }),
      );
    });

    it("includes user name in greeting when provided", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }) as unknown as typeof fetch;

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "John Doe",
      });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall?.[1]?.body as string);
      expect(body.html).toContain("Hi John Doe");
      expect(body.text).toContain("Hi John Doe");
    });

    it("uses generic greeting when user name not provided", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }) as unknown as typeof fetch;

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall?.[1]?.body as string);
      expect(body.html).toContain("Hi,");
      expect(body.text).toContain("Hi,");
    });

    it("returns error when API key is missing", async () => {
      vi.stubEnv("RESEND_API_KEY", "");

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("RESEND_API_KEY");
    });

    it("handles API errors gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Rate limit exceeded" }),
      }) as unknown as typeof fetch;

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit");
    });

    it("handles network errors gracefully", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("escapes HTML in user name to prevent XSS", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }) as unknown as typeof fetch;

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "<script>alert('xss')</script>",
      });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall?.[1]?.body as string);
      expect(body.html).not.toContain("<script>");
      expect(body.html).toContain("&lt;script&gt;");
    });

    it("does not double-encode pre-encoded URL characters", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }) as unknown as typeof fetch;

      // Better Auth produces URLs with already-encoded query params
      const urlWithEncoded =
        "https://clickfolio.me/api/auth/verify-email?token=abc%2Fdef&callbackURL=%2Fdashboard";

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: urlWithEncoded,
      });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall?.[1]?.body as string);
      // %2F must NOT become %252F (double-encoded)
      expect(body.html).toContain("abc%2Fdef");
      expect(body.html).not.toContain("abc%252Fdef");
      expect(body.text).toContain("abc%2Fdef");
      expect(body.text).not.toContain("abc%252Fdef");
    });

    it("returns error for invalid verification URL", async () => {
      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("does not double-encode pre-encoded URL characters", async () => {
      vi.mocked(ofetch).mockResolvedValueOnce({ id: "email_456" });

      const urlWithEncoded = "https://clickfolio.me/api/auth/reset-password?token=abc%2Fdef";

      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: urlWithEncoded,
      });

      expect(result.success).toBe(true);
      // Inspect the body passed to ofetch
      const callArgs = vi.mocked(ofetch).mock.calls[0];
      const body = (callArgs[1] as { body: { html: string; text: string } }).body;
      expect(body.html).toContain("abc%2Fdef");
      expect(body.html).not.toContain("abc%252Fdef");
      expect(body.text).toContain("abc%2Fdef");
      expect(body.text).not.toContain("abc%252Fdef");
    });

    it("returns error for invalid reset URL", async () => {
      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });
});
