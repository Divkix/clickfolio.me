/**
 * Zod schemas for auth-adjacent validation that survives on the server:
 * email format (shared) and the /api/email/validate request body.
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

/**
 * Email validation request schema for the /api/email/validate endpoint.
 */
export const emailValidateSchema = z.object({
  email: emailSchema,
});
