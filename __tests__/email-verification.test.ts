/**
 * Tests for transactional email sending via Cloudflare Email Service.
 * Covers verification and password reset emails, greeting personalization,
 * XSS escaping, URL encoding safety, and graceful error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { clearEmailThrottleForTesting } from "@/lib/auth/email-throttle";
import { createEmailSender } from "@/lib/email/cloudflare";

interface MockEmailResponse {
  to: string;
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
}
describe("email verification", () => {
  const mockAppUrl = "https://clickfolio.me";

  beforeEach(() => {
    clearEmailThrottleForTesting();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearEmailThrottleForTesting();
  });

  function createMockEnv(): CloudflareEnv {
    return {
      EMAIL: {
        send: vi.fn().mockResolvedValue({ messageId: `test-${Date.now()}` }),
      },
      // Include other required bindings for type checking
      CLICKFOLIO_DISPOSABLE_DOMAINS: {} as KVNamespace,
      CLICKFOLIO_R2_BUCKET: {} as R2Bucket,
      CLICKFOLIO_DB: {} as D1Database,
      CLICKFOLIO_PARSE_QUEUE: {} as Queue,
      ASSETS: {} as Fetcher,
      CLICKFOLIO_STATUS_DO: {} as DurableObjectNamespace,
    } as unknown as CloudflareEnv;
  }

  describe("sendVerificationEmail", () => {
    it("sends verification email successfully", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "Test User",
      });

      expect(result.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Verify your email - Clickfolio",
        }),
      );
    });

    it("includes user name in greeting when provided", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "John Doe",
      });

      const callArgs = vi.mocked(env.EMAIL.send).mock.calls[0][0] as MockEmailResponse;
      expect(callArgs.html).toContain("Hi John Doe");
      expect(callArgs.text).toContain("Hi John Doe");
    });

    it("uses generic greeting when user name not provided", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      const callArgs = vi.mocked(env.EMAIL.send).mock.calls[0][0] as MockEmailResponse;
      expect(callArgs.html).toContain("Hi,");
      expect(callArgs.text).toContain("Hi,");
    });

    it("handles email send errors gracefully", async () => {
      const env = createMockEnv();
      vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("Domain not onboarded"));

      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);
      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Domain not onboarded");
    });

    it("escapes HTML in user name to prevent XSS", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        userName: "<script>alert('xss')</script>",
      });

      const callArgs = vi.mocked(env.EMAIL.send).mock.calls[0][0] as MockEmailResponse;
      expect(callArgs.html).not.toContain("<script>");
      expect(callArgs.html).toContain("&lt;script&gt;");
    });

    it("does not double-encode pre-encoded URL characters", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      // Better Auth produces URLs with already-encoded query params
      const urlWithEncoded =
        "https://clickfolio.me/api/auth/verify-email?token=abc%2Fdef&callbackURL=%2Fdashboard";

      await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: urlWithEncoded,
      });

      const callArgs = vi.mocked(env.EMAIL.send).mock.calls[0][0] as MockEmailResponse;
      // %2F must NOT become %252F (double-encoded)
      expect(callArgs.html).toContain("abc%2Fdef");
      expect(callArgs.html).not.toContain("abc%252Fdef");
      expect(callArgs.text).toContain("abc%2Fdef");
      expect(callArgs.text).not.toContain("abc%252Fdef");
    });

    it("returns error for invalid verification URL", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      const result = await sendVerificationEmail({
        email: "test@example.com",
        verificationUrl: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
      expect(env.EMAIL.send).not.toHaveBeenCalled();
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("sends password reset email successfully", async () => {
      const env = createMockEnv();
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=abc123",
        userName: "Test User",
      });

      expect(result.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Reset your password - Clickfolio",
        }),
      );
    });

    it("does not double-encode pre-encoded URL characters", async () => {
      const env = createMockEnv();
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const urlWithEncoded = "https://clickfolio.me/api/auth/reset-password?token=abc%2Fdef";

      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: urlWithEncoded,
      });

      expect(result.success).toBe(true);
      const callArgs = vi.mocked(env.EMAIL.send).mock.calls[0][0] as MockEmailResponse;
      expect(callArgs.html).toContain("abc%2Fdef");
      expect(callArgs.html).not.toContain("abc%252Fdef");
      expect(callArgs.text).toContain("abc%2Fdef");
      expect(callArgs.text).not.toContain("abc%252Fdef");
    });

    it("returns error for invalid reset URL", async () => {
      const env = createMockEnv();
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
      expect(env.EMAIL.send).not.toHaveBeenCalled();
    });

    it("handles email send errors gracefully", async () => {
      const env = createMockEnv();
      vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("Rate limit exceeded"));

      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);
      const result = await sendPasswordResetEmail({
        email: "test@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=abc123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit exceeded");
    });
  });

  describe("email throttling (60s per-email cooldown)", () => {
    it("throttles second verification email within 60s, pretend-sends without calling EMAIL.send", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      const first = await sendVerificationEmail({
        email: "throttle@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      expect(first.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

      const second = await sendVerificationEmail({
        email: "throttle@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      // Throttled: pretend success, do NOT call EMAIL.send again
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it("throttles second password reset within 60s", async () => {
      const env = createMockEnv();
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const first = await sendPasswordResetEmail({
        email: "reset-throttle@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      expect(first.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

      const second = await sendPasswordResetEmail({
        email: "reset-throttle@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it("allows different emails independently", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      const a = await sendVerificationEmail({
        email: "alice@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=1",
      });
      const b = await sendVerificationEmail({
        email: "bob@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=2",
      });
      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    });

    it("normalizes email case for throttle key", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      await sendVerificationEmail({
        email: "CaseSensitive@Example.COM",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=1",
      });
      const second = await sendVerificationEmail({
        email: "casesensitive@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=1",
      });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it("treats verification and reset as separate throttle buckets", async () => {
      const env = createMockEnv();
      const { sendVerificationEmail, sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const v = await sendVerificationEmail({
        email: "same@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=1",
      });
      const r = await sendPasswordResetEmail({
        email: "same@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=1",
      });
      expect(v.success).toBe(true);
      expect(r.success).toBe(true);
      // Different type => both send
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    });

    it("logs warn with domain (not PII) when throttled", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const env = createMockEnv();
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      await sendVerificationEmail({
        email: "throttle-log@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      warnSpy.mockClear();

      const second = await sendVerificationEmail({
        email: "throttle-log@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logLine = warnSpy.mock.calls[0][0] as string;
      // PII-free: should contain domain, not full email
      expect(logLine).toContain("example.com");
      expect(logLine).toContain("Auth email throttled");
      expect(logLine).not.toContain("throttle-log@example.com");
      // Should contain domain field, not expose local part in unexpected way
      expect(logLine).toContain('"domain":"example.com"');
      warnSpy.mockRestore();
    });

    it("logs warn for password reset throttling as well", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const env = createMockEnv();
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      await sendPasswordResetEmail({
        email: "reset-log@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      warnSpy.mockClear();

      const second = await sendPasswordResetEmail({
        email: "reset-log@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      expect(second.success).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logLine = warnSpy.mock.calls[0][0] as string;
      expect(logLine).toContain("example.com");
      expect(logLine).not.toContain("reset-log@example.com");
      expect(logLine).toContain('"type":"reset"');
      warnSpy.mockRestore();
    });

    it("re-sends after 61s expiry when using fake timers", async () => {
      vi.useFakeTimers();
      try {
        const env = createMockEnv();
        const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

        const first = await sendVerificationEmail({
          email: "expiry@example.com",
          verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        });
        expect(first.success).toBe(true);
        expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(61_000);

        const second = await sendVerificationEmail({
          email: "expiry@example.com",
          verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
        });
        expect(second.success).toBe(true);
        expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("re-sends password reset after 61s expiry", async () => {
      vi.useFakeTimers();
      try {
        const env = createMockEnv();
        const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

        const first = await sendPasswordResetEmail({
          email: "expiry-reset@example.com",
          resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
        });
        expect(first.success).toBe(true);
        expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(61_000);

        const second = await sendPasswordResetEmail({
          email: "expiry-reset@example.com",
          resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
        });
        expect(second.success).toBe(true);
        expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("failed verification send does NOT throttle next attempt", async () => {
      const env = createMockEnv();
      vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("transient failure"));
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);

      const first = await sendVerificationEmail({
        email: "failed-not-throttle@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      expect(first.success).toBe(false);
      expect(first.error).toContain("transient failure");
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

      const second = await sendVerificationEmail({
        email: "failed-not-throttle@example.com",
        verificationUrl: "https://clickfolio.me/api/auth/verify-email?token=abc123",
      });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    });

    it("failed password reset send does NOT throttle next attempt", async () => {
      const env = createMockEnv();
      vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("transient"));
      const { sendPasswordResetEmail } = createEmailSender(env, mockAppUrl);

      const first = await sendPasswordResetEmail({
        email: "failed-reset@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      expect(first.success).toBe(false);
      expect(first.error).toContain("transient");
      expect(env.EMAIL.send).toHaveBeenCalledTimes(1);

      const second = await sendPasswordResetEmail({
        email: "failed-reset@example.com",
        resetUrl: "https://clickfolio.me/api/auth/reset-password?token=xyz",
      });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    });

    it("failed send followed by immediate retry still respects throttle after success", async () => {
      const env = createMockEnv();
      vi.mocked(env.EMAIL.send).mockRejectedValueOnce(new Error("first failure"));
      const { sendVerificationEmail } = createEmailSender(env, mockAppUrl);
      const email = "retry-then-throttle@example.com";
      const url = "https://clickfolio.me/api/auth/verify-email?token=abc123";

      const first = await sendVerificationEmail({ email, verificationUrl: url });
      expect(first.success).toBe(false);

      const second = await sendVerificationEmail({ email, verificationUrl: url });
      expect(second.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);

      // Third immediate attempt should now be throttled (since second succeeded and recorded)
      const third = await sendVerificationEmail({ email, verificationUrl: url });
      expect(third.success).toBe(true);
      expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    });
  });
});
