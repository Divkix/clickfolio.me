/**
 * Resend email client wrapper for transactional emails
 *
 * Uses the Resend HTTP API directly via ofetch instead of the full SDK
 * to minimize bundle size on Cloudflare Workers.
 *
 * Used for password reset emails and other auth-related notifications.
 * Designed to work in Cloudflare Workers environment.
 */

import { FetchError, ofetch } from "ofetch";

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
 * Gets the "from" email address for transactional emails
 * Uses the configured domain from BETTER_AUTH_URL or defaults to Resend's test domain
 */
function getFromEmail(): string {
  const appUrl = process.env.BETTER_AUTH_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      // In production, use your verified domain
      // For dev/testing, Resend provides onboarding@resend.dev
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return "Clickfolio <onboarding@resend.dev>";
      }
      return `Clickfolio <noreply@${url.hostname}>`;
    } catch {
      // Invalid URL, fall back to test domain
    }
  }
  return "Clickfolio <onboarding@resend.dev>";
}

interface SendPasswordResetEmailParams {
  email: string;
  resetUrl: string;
  userName?: string;
}

/**
 * Sends a password reset email via the Resend HTTP API
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
}: SendPasswordResetEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const message =
      "Missing RESEND_API_KEY. Set it via .env.local (dev) or 'wrangler secret put RESEND_API_KEY' (prod).";
    console.error("[EMAIL]", message);
    return { success: false, error: message };
  }

  try {
    // Escape user-controlled values for HTML safety
    const safeUserName = userName ? escapeHtml(userName) : null;
    const greeting = safeUserName ? `Hi ${safeUserName},` : "Hi,";
    // Validate URL structure — Better Auth already produces properly-encoded URLs.
    // Do NOT use encodeURI() here: it re-encodes % to %25, mangling query params.
    try {
      new URL(resetUrl);
    } catch {
      return { success: false, error: "Invalid reset URL" };
    }

    const textContent = `${greeting}

You requested to reset your password for your Clickfolio account.

Click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email. Your password won't be changed.

- The Clickfolio Team`;

    const htmlContent = `
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

    <p style="margin: 0 0 24px 0;">You requested to reset your password for your Clickfolio account.</p>

    <a href="${resetUrl}" style="display: inline-block; background: #1a1a1a; color: #fffef5; padding: 12px 24px; text-decoration: none; font-weight: 600; border: 3px solid #1a1a1a; box-shadow: 4px 4px 0 #1a1a1a;">
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
    &copy; Clickfolio
  </p>
</body>
</html>`;

    const response = await ofetch<{ id: string }>("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        from: getFromEmail(),
        to: email,
        subject: "Reset your password - Clickfolio",
        html: htmlContent,
        text: textContent,
      },
    });

    console.log(`[EMAIL] Password reset sent to ${email}, id: ${response.id}`);
    return { success: true };
  } catch (err) {
    if (err instanceof FetchError) {
      const message = (err.data as { message?: string })?.message || err.message;
      console.error("[EMAIL] Resend API error:", message);
      return { success: false, error: message };
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL] Error sending password reset:", message);
    return { success: false, error: message };
  }
}

interface SendVerificationEmailParams {
  email: string;
  verificationUrl: string;
  userName?: string;
}

/**
 * Sends an email verification email via the Resend HTTP API
 *
 * @param params.email - Recipient email address
 * @param params.verificationUrl - Email verification URL with token
 * @param params.userName - Optional user name for personalization
 * @returns Promise resolving to success boolean and optional error message
 */
export async function sendVerificationEmail({
  email,
  verificationUrl,
  userName,
}: SendVerificationEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const message =
      "Missing RESEND_API_KEY. Set it via .env.local (dev) or 'wrangler secret put RESEND_API_KEY' (prod).";
    console.error("[EMAIL]", message);
    return { success: false, error: message };
  }

  try {
    // Escape user-controlled values for HTML safety
    const safeUserName = userName ? escapeHtml(userName) : null;
    const greeting = safeUserName ? `Hi ${safeUserName},` : "Hi,";
    // Validate URL structure — Better Auth already produces properly-encoded URLs.
    // Do NOT use encodeURI() here: it re-encodes % to %25, mangling query params.
    try {
      new URL(verificationUrl);
    } catch {
      return { success: false, error: "Invalid verification URL" };
    }

    const textContent = `${greeting}

Thanks for signing up for Clickfolio! Please verify your email address to complete your registration.

Click the link below to verify your email:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create a Clickfolio account, you can safely ignore this email.

- The Clickfolio Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border: 3px solid #1a1a1a; padding: 32px; background: #fffef5;">
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 24px 0;">Verify your email</h1>

    <p style="margin: 0 0 16px 0;">${greeting}</p>

    <p style="margin: 0 0 24px 0;">Thanks for signing up for Clickfolio! Please verify your email address to complete your registration.</p>

    <a href="${verificationUrl}" style="display: inline-block; background: #1a1a1a; color: #fffef5; padding: 12px 24px; text-decoration: none; font-weight: 600; border: 3px solid #1a1a1a; box-shadow: 4px 4px 0 #1a1a1a;">
      Verify Email
    </a>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      This link will expire in 24 hours.
    </p>

    <p style="margin: 16px 0 0 0; font-size: 14px; color: #666;">
      If you didn't create a Clickfolio account, you can safely ignore this email.
    </p>
  </div>

  <p style="margin: 24px 0 0 0; font-size: 12px; color: #999; text-align: center;">
    &copy; Clickfolio
  </p>
</body>
</html>`;

    // Use native fetch instead of ofetch for test compatibility
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: email,
        subject: "Verify your email - Clickfolio",
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      const message = errorData.message || `API error: ${response.status}`;
      console.error("[EMAIL] Resend API error:", message);
      return { success: false, error: message };
    }

    const data = (await response.json()) as { id: string };
    console.log(`[EMAIL] Verification email sent to ${email}, id: ${data.id}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[EMAIL] Error sending verification email:", message);
    return { success: false, error: message };
  }
}
