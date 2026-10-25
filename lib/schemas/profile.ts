import { z } from "zod";
import { USER_ROLES } from "@/lib/config/roles";
import { handleSchema } from "@/lib/schemas/handle";

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

export const handleUpdateSchema = z.object({
  handle: handleSchema,
});

export type HandleUpdate = z.infer<typeof handleUpdateSchema>;

export const roleUpdateSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isFreelance: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isFreelance !== undefined, {
    message: "Provide role or isFreelance",
  });

export function buildWizardCompleteSchema(themeIds: readonly [string, ...string[]]) {
  return z.object({
    handle: handleSchema,
    privacy_settings: privacySettingsInputSchema,
    theme_id: z.enum(themeIds),
  });
}
