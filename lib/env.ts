/**
 * Environment variable validation and access
 *
 * Supports hybrid loading:
 * 1. Check Cloudflare env bindings first (production)
 * 2. Fall back to process.env (development with .env.local)
 */

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

// Cache for Cloudflare env (set once per request context)
const _cfEnv: Partial<CloudflareEnv> | null = null;

/**
 * Get env value from Cloudflare binding or process.env
 * Cloudflare env takes precedence over process.env
 */
function getEnvValue(key: string): string | undefined {
  // Try Cloudflare env first (production Workers)
  if (_cfEnv && key in _cfEnv) {
    const value = _cfEnv[key as keyof CloudflareEnv];
    if (typeof value === "string") {
      return value;
    }
  }
  // Fall back to process.env (development)
  return process.env[key];
}

/**
 * Gets a required environment variable
 * Throws error if not set in either Cloudflare env or process.env
 */
function getRequiredEnv(key: string): string {
  const value = getEnvValue(key);
  if (!value || value.trim() === "") {
    throw new EnvironmentError(
      `Missing required environment variable: ${key}\n` +
        `Please set it in your .env.local file (development) or via 'wrangler secret put ${key}' (production).`,
    );
  }
  return value;
}

/**
 * Gets an optional environment variable, returns undefined if not set
 */
function getEnvVar(key: string, required: boolean = true): string | undefined {
  const value = getEnvValue(key);
  if (required && (!value || value.trim() === "")) {
    throw new EnvironmentError(
      `Missing required environment variable: ${key}\n` +
        `Please set it in your .env.local file (development) or via 'wrangler secret put ${key}' (production).`,
    );
  }
  return value || undefined;
}

/**
 * Validates all required environment variables
 * Call this at app startup to fail fast
 */
export function validateEnvironment(): void {
  const requiredVars = [
    // Better Auth
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",

    // Google OAuth
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",

    // R2
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",

    // Cloudflare AI Gateway
    "CF_AI_GATEWAY_ACCOUNT_ID",
    "CF_AI_GATEWAY_ID",
    "CF_AIG_AUTH_TOKEN",

    // Replicate
    "REPLICATE_API_TOKEN",
    // REPLICATE_WEBHOOK_SECRET is validated separately as it's critical for production
    // but may be absent in development. See ENV.REPLICATE_WEBHOOK_SECRET below.
  ];

  const missing = requiredVars.filter((key) => {
    const value = getEnvValue(key);
    return !value || value.trim() === "";
  });

  if (missing.length > 0) {
    const missingKeys = missing.map((v) => `  - ${v}`).join("\n");
    throw new EnvironmentError(
      `Missing required environment variables:\n${missingKeys}\n\n` +
        `For development: Set these in your .env.local file.\n` +
        `For production: Run 'wrangler secret put <KEY>' for each.`,
    );
  }
}

/**
 * Typed environment variable accessors
 * Each returns a getter function for lazy evaluation
 */
export const ENV = {
  // Better Auth
  BETTER_AUTH_SECRET: () => getRequiredEnv("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: () => getRequiredEnv("BETTER_AUTH_URL"),

  // Google OAuth
  GOOGLE_CLIENT_ID: () => getRequiredEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: () => getRequiredEnv("GOOGLE_CLIENT_SECRET"),

  // R2
  R2_ENDPOINT: () => getRequiredEnv("R2_ENDPOINT"),
  R2_ACCESS_KEY_ID: () => getRequiredEnv("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: () => getRequiredEnv("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: () => getRequiredEnv("R2_BUCKET_NAME"),

  // Cloudflare AI Gateway
  CF_AI_GATEWAY_ACCOUNT_ID: () => getRequiredEnv("CF_AI_GATEWAY_ACCOUNT_ID"),
  CF_AI_GATEWAY_ID: () => getRequiredEnv("CF_AI_GATEWAY_ID"),
  CF_AIG_AUTH_TOKEN: () => getRequiredEnv("CF_AIG_AUTH_TOKEN"),

  // Replicate
  REPLICATE_API_TOKEN: () => getRequiredEnv("REPLICATE_API_TOKEN"),
  /**
   * CRITICAL FOR PRODUCTION SECURITY:
   * The webhook secret is required to validate that incoming webhook requests
   * actually originate from Replicate. Without this, attackers could forge
   * webhook payloads to manipulate resume parsing status.
   *
   * This is REQUIRED in production. In development, you may skip webhook
   * validation by not setting this variable, but this is strongly discouraged.
   *
   * Generate a secure secret: openssl rand -base64 32
   * Set in production: wrangler secret put REPLICATE_WEBHOOK_SECRET
   */
  REPLICATE_WEBHOOK_SECRET: () => getRequiredEnv("REPLICATE_WEBHOOK_SECRET"),

  // Optional - Public app URL
  NEXT_PUBLIC_APP_URL: () => getEnvVar("NEXT_PUBLIC_APP_URL", false),
} as const;
