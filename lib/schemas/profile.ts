import { z } from "zod";
import { sanitizeUrl, containsXssPattern } from "@/lib/utils/sanitization";

/**
 * Custom Zod refinement for XSS detection
 */
const noXssPattern = (value: string) => {
  if (containsXssPattern(value)) {
    return false;
  }
  return true;
};

/**
 * Privacy settings schema
 * Controls what information is visible on the public resume page
 */
export const privacySettingsSchema = z.object({
  show_phone: z.boolean({
    message: "Phone visibility setting must be a boolean",
  }),
  show_address: z.boolean({
    message: "Address visibility setting must be a boolean",
  }),
});

/**
 * Handle validation schema
 * Enforces uniqueness, format, and length constraints
 * Includes security checks to prevent injection attacks
 */
export const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must not exceed 30 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Handle can only contain lowercase letters, numbers, and hyphens",
  )
  .regex(/^[a-z0-9]/, "Handle must start with a letter or number")
  .regex(/[a-z0-9]$/, "Handle must end with a letter or number")
  .regex(/^(?!.*--)/, "Handle cannot contain consecutive hyphens")
  .refine(noXssPattern, { message: "Invalid content detected" });

/**
 * Handle update request schema
 */
export const handleUpdateSchema = z.object({
  handle: handleSchema,
});

/**
 * Profile update schema
 * Optional fields for partial updates
 * Includes sanitization for URLs and text content
 */
export const profileUpdateSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, "Email is too long")
    .optional(),
  avatar_url: z
    .string()
    .trim()
    .url({ message: "Invalid URL" })
    .max(2000, "URL is too long")
    .transform(sanitizeUrl)
    .nullable()
    .optional(),
  headline: z
    .string()
    .trim()
    .max(100, "Headline must not exceed 100 characters")
    .refine(noXssPattern, { message: "Invalid content detected" })
    .nullable()
    .optional(),
});

// Type exports for TypeScript inference
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type HandleUpdate = z.infer<typeof handleUpdateSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
