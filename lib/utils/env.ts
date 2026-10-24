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
