/**
 * Cloudflare Workers environment bindings type definition
 *
 * This interface defines all environment variables and bindings available
 * to the Cloudflare Workers runtime. Secrets are set via `wrangler secret put`.
 *
 * Usage:
 * - D1 database is accessed via env.DB
 * - Secrets are accessed via env.SECRET_NAME
 * - Falls back to process.env in development
 */
export interface CloudflareEnv {
  // D1 Database binding (configured in wrangler.jsonc)
  DB: D1Database;

  // Assets binding (configured in wrangler.jsonc)
  ASSETS: Fetcher;

  // Better Auth secrets
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // Google OAuth credentials
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // Cloudflare R2 storage credentials
  R2_ENDPOINT: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;

  // Cloudflare AI Gateway (BYOK) credentials
  CF_AI_GATEWAY_ACCOUNT_ID: string;
  CF_AI_GATEWAY_ID: string;
  CF_AIG_AUTH_TOKEN: string;

  // Replicate API
  REPLICATE_API_TOKEN: string;
  REPLICATE_WEBHOOK_SECRET?: string;

  // Resend email API
  RESEND_API_KEY?: string;

  // Public app URL (optional)
  NEXT_PUBLIC_APP_URL?: string;
}

