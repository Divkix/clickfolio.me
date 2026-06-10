import { z } from "zod";
import { emailSchema } from "@/lib/schemas/auth";

/**
 * Schema for account deletion request
 * Requires the user to type their email address for confirmation
 */
export const deleteAccountSchema = z.object({
  confirmation: emailSchema.describe("Email confirmation for account deletion"),
});
