import { z } from "zod";
import { containsXssPattern } from "@/lib/utils/sanitization";

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
const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must not exceed 30 characters")
  .regex(/^[a-z0-9-]+$/, "Handle can only contain lowercase letters, numbers, and hyphens")
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

// Type exports for TypeScript inference
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type HandleUpdate = z.infer<typeof handleUpdateSchema>;
