import { z } from "zod";

/**
 * Read an environment value from the Workers binding with a `process.env`
 * fallback (handy for scripts and local Node contexts), returning `undefined`
 * when the key is missing or blank.
 */
export function getOptionalEnvValue<K extends keyof CloudflareEnv>(
  env: Partial<CloudflareEnv>,
  key: K,
): string | undefined {
  const bindingValue = z
    .string()
    .refine((value) => value.trim() !== "")
    .safeParse(env[key]);
  if (bindingValue.success) return bindingValue.data;
  const processValue = process.env[key];
  if (processValue !== undefined && processValue.trim() !== "") {
    return processValue;
  }
  return undefined;
}

/**
 * Read a required environment value from the Workers binding with a
 * `process.env` fallback, throwing a descriptive error when missing.
 *
 * Relocated from the removed Better Auth module (`lib/auth/index.ts`); the
 * remaining consumers are pending-upload HMAC signing/verification
 * (`PENDING_UPLOAD_SECRET`) and other app-owned secrets.
 */
export function getEnvValue<K extends keyof CloudflareEnv>(
  env: Partial<CloudflareEnv>,
  key: K,
): string {
  const value = getOptionalEnvValue(env, key);
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Set it via .dev.vars (dev) or 'wrangler secret put ${key}' (prod).`,
    );
  }
  return value;
}
