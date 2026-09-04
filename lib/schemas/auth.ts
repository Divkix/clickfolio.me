import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email({ message: "Invalid email address" })
  .max(255, "Email is too long");
