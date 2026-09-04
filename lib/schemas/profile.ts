import { z } from "zod";
import { noXssPattern } from "@/lib/utils/sanitization";

export const privacySettingsSchema = z.object({
  show_phone: z.boolean({
    message: "Phone visibility setting must be a boolean",
  }),
  show_address: z.boolean({
    message: "Address visibility setting must be a boolean",
  }),
  hide_from_search: z.boolean({
    message: "Search visibility setting must be a boolean",
  }),
  show_in_directory: z.boolean({
    message: "Directory visibility setting must be a boolean",
  }),
});

export const privacySettingsInputSchema = z.object({
  show_phone: z.boolean({
    message: "Phone visibility setting must be a boolean",
  }),
  show_address: z.boolean({
    message: "Address visibility setting must be a boolean",
  }),
  hide_from_search: z
    .boolean({ message: "Search visibility setting must be a boolean" })
    .optional()
    .default(false),
  show_in_directory: z
    .boolean({ message: "Directory visibility setting must be a boolean" })
    .optional()
    .default(true),
});

export const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must not exceed 30 characters")
  .regex(/^[a-z0-9-]+$/, "Handle can only contain lowercase letters, numbers, and hyphens")
  .regex(/^[a-z0-9]/, "Handle must start with a letter or number")
  .regex(/[a-z0-9]$/, "Handle must end with a letter or number")
  .regex(/^(?!.*--)/, "Handle cannot contain consecutive hyphens")
  .refine(noXssPattern, { message: "Invalid content detected" });

export const handleUpdateSchema = z.object({
  handle: handleSchema,
});

export type HandleUpdate = z.infer<typeof handleUpdateSchema>;

export const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "entry_level", label: "Entry Level" },
  { value: "mid_level", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "executive", label: "Executive" },
] as const;

export const roleUpdateSchema = z.object({
  role: z.enum(["student", "entry_level", "mid_level", "senior", "executive"]),
});

export function buildWizardCompleteSchema(themeIds: readonly [string, ...string[]]) {
  return z.object({
    handle: handleSchema,
    privacy_settings: privacySettingsInputSchema,
    theme_id: z.enum(themeIds),
  });
}
