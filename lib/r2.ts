/**
 * Cloudflare R2 storage client
 *
 * Supports hybrid environment loading:
 * - Production: Pass env from getCloudflareContext()
 * - Development: Falls back to process.env via ENV helpers
 */

import { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./env";

// Singleton clients (cached per endpoint/credentials combo)
let _r2Client: S3Client | null = null;
let _r2Bucket: string | null = null;
let _lastEndpoint: string | null = null;

/**
 * Get env value with Cloudflare binding fallback to ENV helpers
 */
function getEnvValue(
  env: Partial<CloudflareEnv> | undefined,
  key: "R2_ENDPOINT" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME",
): string {
  if (env) {
    const cfValue = env[key];
    if (typeof cfValue === "string" && cfValue.trim() !== "") {
      return cfValue;
    }
  }
  // Fall back to ENV helper (which uses process.env)
  return ENV[key]();
}

/**
 * Get R2 client instance
 *
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Configured S3Client for R2
 *
 * @example
 * ```ts
 * // In API route with Cloudflare context
 * const { env } = await getCloudflareContext({ async: true });
 * const r2Client = getR2Client(env);
 *
 * // In development (uses process.env)
 * const r2Client = getR2Client();
 * ```
 */
export function getR2Client(env?: Partial<CloudflareEnv>): S3Client {
  const endpoint = getEnvValue(env, "R2_ENDPOINT");

  // Invalidate cache if endpoint changed (shouldn't happen in practice)
  if (_r2Client && _lastEndpoint !== endpoint) {
    _r2Client = null;
  }

  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: getEnvValue(env, "R2_ACCESS_KEY_ID"),
        secretAccessKey: getEnvValue(env, "R2_SECRET_ACCESS_KEY"),
      },
      // Disable automatic checksum calculation to avoid CORS issues with R2
      // AWS SDK v3 automatically adds x-amz-checksum-* headers which R2 CORS doesn't allow by default
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    _lastEndpoint = endpoint;
  }

  return _r2Client;
}

/**
 * Get R2 bucket name
 *
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Configured bucket name
 */
export function getR2Bucket(env?: Partial<CloudflareEnv>): string {
  if (!_r2Bucket) {
    _r2Bucket = getEnvValue(env, "R2_BUCKET_NAME");
  }
  return _r2Bucket;
}
