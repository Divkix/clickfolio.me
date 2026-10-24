import { z } from "zod";
import { USER_ROLES } from "@/lib/config/roles";
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

// Postgres timestamptz text ("2026-10-23 23:28:57.872123-06") or ISO 8601 ("…T…Z"), offset required.
const ROW_VERSION_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-](0\d|1[0-4])(:?[0-5]\d)?)$/;

function isCalendarDate(value: string): boolean {
  const [, year, month, day] = ROW_VERSION_PATTERN.exec(value) ?? [];
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

/**
 * The `updated_at` a client loaded, echoed back in `If-Unmodified-Since`. Only exact timestamp
 * literals pass: Postgres would also accept words like `now` or `infinity`, or reject junk with
 * a 500, and an HTTP-date loses the sub-second precision the equality check needs.
 */
export const rowVersionSchema = z
  .string()
  .max(40)
  .regex(ROW_VERSION_PATTERN)
  .refine(isCalendarDate, "Not a calendar date");

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
