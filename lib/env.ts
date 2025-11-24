/**
 * Environment variable validation
 * Validates required env vars at startup to fail fast
 */

interface EnvVar {
  key: string;
  value: string | undefined;
  required: boolean;
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

/**
 * Gets a required environment variable
 * Throws error if not set
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new EnvironmentError(
      `Missing required environment variable: ${key}\n` +
        `Please set it in your .env file or deployment environment.`,
    );
  }
  return value;
}

/**
 * Gets an optional environment variable, returns undefined if not set
 */
function getEnvVar(key: string, required: boolean = true): string | undefined {
  const value = process.env[key];
  if (required && (!value || value.trim() === "")) {
    throw new EnvironmentError(
      `Missing required environment variable: ${key}\n` +
        `Please set it in your .env file or deployment environment.`,
    );
  }
  return value || undefined;
}

/**
 * Validates all required environment variables
 * Call this at app startup to fail fast
 */
export function validateEnvironment(): void {
  const requiredVars: EnvVar[] = [
    // Supabase
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      required: true,
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      required: true,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      value: process.env.SUPABASE_SERVICE_ROLE_KEY,
      required: true,
    },

    // R2
    { key: "R2_ENDPOINT", value: process.env.R2_ENDPOINT, required: true },
    {
      key: "R2_ACCESS_KEY_ID",
      value: process.env.R2_ACCESS_KEY_ID,
      required: true,
    },
    {
      key: "R2_SECRET_ACCESS_KEY",
      value: process.env.R2_SECRET_ACCESS_KEY,
      required: true,
    },
    {
      key: "R2_BUCKET_NAME",
      value: process.env.R2_BUCKET_NAME,
      required: true,
    },

    // Replicate
    {
      key: "REPLICATE_API_TOKEN",
      value: process.env.REPLICATE_API_TOKEN,
      required: true,
    },
  ];

  const missing = requiredVars.filter((v) => v.required && (!v.value || v.value.trim() === ""));

  if (missing.length > 0) {
    const missingKeys = missing.map((v) => `  - ${v.key}`).join("\n");
    throw new EnvironmentError(
      `Missing required environment variables:\n${missingKeys}\n\n` +
        `Please configure these in your .env file or deployment environment.`,
    );
  }
}

// Export typed environment variables
export const ENV = {
  // Supabase
  SUPABASE_URL: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: () => getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: () => getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // R2
  R2_ENDPOINT: () => getRequiredEnv("R2_ENDPOINT"),
  R2_ACCESS_KEY_ID: () => getRequiredEnv("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: () => getRequiredEnv("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: () => getRequiredEnv("R2_BUCKET_NAME"),

  // Replicate
  REPLICATE_API_TOKEN: () => getRequiredEnv("REPLICATE_API_TOKEN"),
  REPLICATE_WEBHOOK_SECRET: () => getEnvVar("REPLICATE_WEBHOOK_SECRET", false), // optional for local dev
} as const;
