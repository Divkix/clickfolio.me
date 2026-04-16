/**
 * Cloudflare Email Service client for transactional emails
 *
 * Uses the native Workers binding (env.EMAIL) for password resets
 * and email verification. No API keys needed.
 */

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
 * Uses the configured domain from BETTER_AUTH_URL
 */
function getFromEmail(appUrl: string): { email: string; name: string } {
  try {
    const url = new URL(appUrl);
    // For localhost dev, use a placeholder domain (emails won't actually send without onboarding)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return { email: "noreply@clickfolio.me", name: "Clickfolio" };
    }
    return { email: `noreply@${url.hostname}`, name: "Clickfolio" };
  } catch {
    // Invalid URL, fall back to default
    return { email: "noreply@clickfolio.me", name: "Clickfolio" };
  }
}

interface SendPasswordResetEmailParams {
  email: string;
  resetUrl: string;
  userName?: string;
}

interface SendVerificationEmailParams {
  email: string;
  verificationUrl: string;
  userName?: string;
}

/**
 * Creates email sender functions bound to the Cloudflare Email Service
 *
 * @param env - Cloudflare Workers environment with EMAIL binding
 * @param appUrl - The application base URL for constructing from addresses
 * @returns Object with sendPasswordResetEmail and sendVerificationEmail functions
 */
export function createEmailSender(env: CloudflareEnv, appUrl: string) {
  const from = getFromEmail(appUrl);

  /**
   * Sends a password reset email via Cloudflare Email Service
   */
  async function sendPasswordResetEmail({
    email,
    resetUrl,
    userName,
  }: SendPasswordResetEmailParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate URL structure — Better Auth already produces properly-encoded URLs.
      // Do NOT use encodeURI() here: it re-encodes % to %25, mangling query params.
      try {
        new URL(resetUrl);
      } catch {
        return { success: false, error: "Invalid reset URL" };
      }

      // Escape user-controlled values for HTML safety
      const safeUserName = userName ? escapeHtml(userName) : null;
      const greeting = safeUserName ? `Hi ${safeUserName},` : "Hi,";

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

      await env.EMAIL.send({
        to: email,
        from,
        subject: "Reset your password - Clickfolio",
        html: htmlContent,
        text: textContent,
      });

      console.log(`[EMAIL] Password reset sent to ${email}`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[EMAIL] Error sending password reset:", message);
      return { success: false, error: message };
    }
  }

  /**
   * Sends an email verification email via Cloudflare Email Service
   */
  async function sendVerificationEmail({
    email,
    verificationUrl,
    userName,
  }: SendVerificationEmailParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate URL structure — Better Auth already produces properly-encoded URLs.
      // Do NOT use encodeURI() here: it re-encodes % to %25, mangling query params.
      try {
        new URL(verificationUrl);
      } catch {
        return { success: false, error: "Invalid verification URL" };
      }

      // Escape user-controlled values for HTML safety
      const safeUserName = userName ? escapeHtml(userName) : null;
      const greeting = safeUserName ? `Hi ${safeUserName},` : "Hi,";

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

      await env.EMAIL.send({
        to: email,
        from,
        subject: "Verify your email - Clickfolio",
        html: htmlContent,
        text: textContent,
      });

      console.log(`[EMAIL] Verification email sent to ${email}`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[EMAIL] Error sending verification email:", message);
      return { success: false, error: message };
    }
  }

  return {
    sendPasswordResetEmail,
    sendVerificationEmail,
  };
}
