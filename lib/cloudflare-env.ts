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

  // Public app URL (optional)
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Type guard to check if a key exists in CloudflareEnv
 */
export function isCloudflareEnvKey(key: string): key is keyof CloudflareEnv {
  const envKeys: Array<keyof CloudflareEnv> = [
    "DB",
    "ASSETS",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "CF_AI_GATEWAY_ACCOUNT_ID",
    "CF_AI_GATEWAY_ID",
    "CF_AIG_AUTH_TOKEN",
    "REPLICATE_API_TOKEN",
    "REPLICATE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ];
  return envKeys.includes(key as keyof CloudflareEnv);
}
