import { describe, expect, it, vi } from "vitest";
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
});
