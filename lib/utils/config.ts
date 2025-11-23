/**
 * Environment Configuration Validation
 *
 * Validates required environment variables and provides
 * type-safe access to configuration values.
 */

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "REPLICATE_API_TOKEN",
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  MAX_UPLOAD_SIZE_MB: "10",
  RATE_LIMIT_UPLOADS_PER_DAY: "5",
  RATE_LIMIT_UPDATES_PER_HOUR: "10",
} as const;

/**
 * Type-safe configuration object
 */
export interface AppConfig {
  // Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  // Cloudflare R2
  r2: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
  // Replicate AI
  replicate: {
    apiToken: string;
  };
  // App settings
  app: {
    url: string;
    maxUploadSizeMb: number;
  };
  // Rate limits
  rateLimit: {
    uploadsPerDay: number;
    updatesPerHour: number;
  };
  // Environment
  env: {
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
  };
}

/**
 * Validate that all required environment variables are set
 * @throws Error if any required variables are missing
 */
function validateRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n\n` +
        "Please check your .env.local file and ensure all required variables are set.",
    );
  }
}

/**
 * Get environment variable value with fallback
 */
function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name];
  if (!value) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Parse integer from environment variable
 */
function parseEnvInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(
      `Invalid integer value for ${name}: ${value}, using fallback: ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}

/**
 * Get application configuration
 * Validates and returns all config values
 */
export function getConfig(): AppConfig {
  // Validate required variables first
  validateRequiredEnvVars();

  return {
    supabase: {
      url: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
      anonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      serviceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
    },
    r2: {
      endpoint: getEnvVar("R2_ENDPOINT"),
      accessKeyId: getEnvVar("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnvVar("R2_SECRET_ACCESS_KEY"),
      bucketName: getEnvVar("R2_BUCKET_NAME"),
    },
    replicate: {
      apiToken: getEnvVar("REPLICATE_API_TOKEN"),
    },
    app: {
      url: getEnvVar(
        "NEXT_PUBLIC_APP_URL",
        OPTIONAL_ENV_VARS.NEXT_PUBLIC_APP_URL,
      ),
      maxUploadSizeMb: parseEnvInt("MAX_UPLOAD_SIZE_MB", 10),
    },
    rateLimit: {
      uploadsPerDay: parseEnvInt("RATE_LIMIT_UPLOADS_PER_DAY", 5),
      updatesPerHour: parseEnvInt("RATE_LIMIT_UPDATES_PER_HOUR", 10),
    },
    env: {
      isProduction: isProduction(),
      isDevelopment: isDevelopment(),
      isTest: isTest(),
    },
  };
}

/**
 * Lazy-loaded config instance
 * Only validated when first accessed
 */
let configInstance: AppConfig | null = null;

/**
 * Get the singleton config instance
 * Validates environment variables on first access
 */
export function config(): AppConfig {
  if (!configInstance) {
    configInstance = getConfig();
  }
  return configInstance;
}

/**
 * Feature flags for development/production
 */
export const featureFlags = {
  // Enable verbose logging in development
  verboseLogging: isDevelopment(),

  // Enable debug mode in development
  debugMode: isDevelopment(),

  // Enable rate limiting (production only)
  rateLimiting: isProduction(),

  // Enable analytics (production only)
  analytics: isProduction(),

  // Enable error reporting (production only)
  errorReporting: isProduction(),
} as const;
