/**
 * Zod schemas for auth-adjacent validation that survives on the server.
 *
 * Sign-in/sign-up/password-reset form schemas were removed with the custom
 * forms — Clerk's prebuilt UI owns those flows.
 */

import { z } from "zod";

/**
 * Email validation with proper format check.
 * Exported for reuse across auth-related schemas.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email({ message: "Invalid email address" })
  .max(255, "Email is too long");
