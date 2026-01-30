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

    // Note: AI Gateway vars are now in ai-parser-worker, not here
    // Note: R2 is accessed via binding (R2_BUCKET), no env var needed
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
} as const;
