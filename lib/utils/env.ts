import { z } from "zod";

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
