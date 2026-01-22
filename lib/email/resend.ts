/**
 * Email client using Resend API with native fetch
 *
 * Replaces the Resend SDK to reduce bundle size
 * Uses direct HTTP calls to the Resend API
 */

/**
 * Get API key from Cloudflare binding or process.env
 */
function getApiKey(env?: Partial<CloudflareEnv>): string {
  if (env) {
    const cfValue = (env as Record<string, unknown>).RESEND_API_KEY;
    if (typeof cfValue === "string" && cfValue.trim() !== "") {
      return cfValue;
    }
  }
  const processValue = process.env.RESEND_API_KEY;
  if (processValue && processValue.trim() !== "") {
    return processValue;
  }
  throw new Error(
    "Missing required environment variable: RESEND_API_KEY. " +
      "Set it via .env.local (dev) or 'wrangler secret put RESEND_API_KEY' (prod).",
  );
}

/**
 * Default sender email for transactional emails
 */
export const DEFAULT_FROM_EMAIL = "webresume.now <noreply@webresume.now>";

/**
 * Email options for sending
 */
interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
}

/**
 * Resend API response
 */
interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name?: string;
  };
}

/**
 * Send an email using Resend API with native fetch
 *
 * @param options - Email options
 * @param env - Optional Cloudflare env bindings
 * @returns Promise with the response from Resend API
 *
 * @example
 * ```ts
 * await sendEmail({
 *   from: DEFAULT_FROM_EMAIL,
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   html: "<p>Hello world</p>",
 * }, env);
 * ```
 */
export async function sendEmail(
  options: SendEmailOptions,
  env?: Partial<CloudflareEnv>,
): Promise<{ id: string }> {
  const apiKey = getApiKey(env);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.reply_to,
    }),
  });

  const data = (await response.json()) as ResendResponse;

  if (!response.ok) {
    const errorMessage = data.error?.message || `HTTP ${response.status}: Failed to send email`;
    throw new Error(errorMessage);
  }

  if (!data.id) {
    throw new Error("Resend API did not return an email ID");
  }

  return { id: data.id };
}
