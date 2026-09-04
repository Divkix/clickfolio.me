import { z } from "zod";
import { emailSchema } from "@/lib/schemas/auth";

export const deleteAccountSchema = z.object({
  confirmation: emailSchema.describe("Email confirmation for account deletion"),
});
