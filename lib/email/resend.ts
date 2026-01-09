/**
 * Resend email client for transactional emails
 *
 * Supports hybrid environment loading:
 * - Production: Pass env from getCloudflareContext()
 * - Development: Falls back to process.env
 */

import { Resend } from "resend";

// Singleton client
let _resendClient: Resend | null = null;
let _lastApiKey: string | null = null;

/**
 * Get env value with Cloudflare binding fallback to process.env
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
 * Get Resend client instance
 *
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Configured Resend client
 *
 * @example
 * ```ts
 * // In API route with Cloudflare context
 * const { env } = await getCloudflareContext({ async: true });
 * const resend = getResendClient(env);
 * await resend.emails.send({ ... });
 * ```
 */
export function getResendClient(env?: Partial<CloudflareEnv>): Resend {
  const apiKey = getApiKey(env);

  // Invalidate cache if API key changed
  if (_resendClient && _lastApiKey !== apiKey) {
    _resendClient = null;
  }

  if (!_resendClient) {
    _resendClient = new Resend(apiKey);
    _lastApiKey = apiKey;
  }

  return _resendClient;
}

/**
 * Default sender email for transactional emails
 */
export const DEFAULT_FROM_EMAIL = "webresume.now <noreply@webresume.now>";
