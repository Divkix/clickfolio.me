/**
 * Resend email client wrapper for transactional emails
 *
 * Used for password reset emails and other auth-related notifications.
 * Designed to work in Cloudflare Workers environment.
 */

import { Resend } from "resend";

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Lazy-initialized Resend client
 * API key is read from environment at call time for Workers compatibility
 */
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing RESEND_API_KEY. Set it via .env.local (dev) or 'wrangler secret put RESEND_API_KEY' (prod).",
      );
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Gets the "from" email address for transactional emails
 * Uses the configured domain from NEXT_PUBLIC_APP_URL or defaults to Resend's test domain
 */
function getFromEmail(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      // In production, use your verified domain
      // For dev/testing, Resend provides onboarding@resend.dev
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return "WebResume <onboarding@resend.dev>";
      }
      return `WebResume <noreply@${url.hostname}>`;
    } catch {
      // Invalid URL, fall back to test domain
    }
  }
  return "WebResume <onboarding@resend.dev>";
}

interface SendPasswordResetEmailParams {
  email: string;
  resetUrl: string;
  userName?: string;
}

/**
 * Sends a password reset email via Resend
 *
 * IMPORTANT: This function should NOT be awaited in the Better Auth
 * sendResetPassword callback to prevent timing attacks. Fire-and-forget.
 *
 * @param params.email - Recipient email address
 * @param params.resetUrl - Password reset URL with token
 * @param params.userName - Optional user name for personalization
 * @returns Promise resolving to success boolean and optional error message
 */
export async function sendPasswordResetEmail({
  email,
  resetUrl,
  userName,
}: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    // Escape user-controlled values for HTML safety
    const safeUserName = userName ? escapeHtml(userName) : null;
    const greeting = safeUserName ? `Hi ${safeUserName},` : "Hi,";
    // Encode URL to prevent injection via URL parameters
    const safeResetUrl = encodeURI(resetUrl);

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: "Reset your password - WebResume",
      text: `${greeting}

You requested to reset your password for your WebResume account.

Click the link below to set a new password:
${safeResetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email. Your password won't be changed.

- The WebResume Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border: 3px solid #1a1a1a; padding: 32px; background: #fffef5;">
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 24px 0;">Reset your password</h1>

    <p style="margin: 0 0 16px 0;">${greeting}</p>

    <p style="margin: 0 0 24px 0;">You requested to reset your password for your WebResume account.</p>

    <a href="${safeResetUrl}" style="display: inline-block; background: #1a1a1a; color: #fffef5; padding: 12px 24px; text-decoration: none; font-weight: 600; border: 3px solid #1a1a1a; box-shadow: 4px 4px 0 #1a1a1a;">
      Reset Password
    </a>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      This link will expire in 1 hour.
    </p>

    <p style="margin: 16px 0 0 0; font-size: 14px; color: #666;">
      If you didn't request this, you can safely ignore this email. Your password won't be changed.
    </p>
  </div>

  <p style="margin: 24px 0 0 0; font-size: 12px; color: #999; text-align: center;">
    &copy; WebResume
  </p>
</body>
</html>`,
    });

    if (error) {
      console.error("[EMAIL] Failed to send password reset:", error.message);
      return { success: false, error: error.message };
    }

    console.log(`[EMAIL] Password reset sent to ${email}, id: ${data?.id}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL] Error sending password reset:", message);
    return { success: false, error: message };
  }
}
