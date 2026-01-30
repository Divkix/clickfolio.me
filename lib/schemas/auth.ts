import { z } from "zod";

/**
 * Password validation requirements
 * - Minimum 8 characters (Better Auth default)
 * - Maximum 128 characters (prevent DoS)
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

/**
 * Email validation with proper format check
 */
const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email({ message: "Invalid email address" })
  .max(255, "Email is too long");

/**
 * Sign up form schema
 *
 * Validates user registration data for email/password sign up.
 * Name is required for Better Auth user creation.
 */
export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * Sign in form schema
 *
 * Validates login credentials. Password min length not enforced here
 * since existing users may have varying password requirements.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Forgot password form schema
 *
 * Only requires email address. Response should not reveal
 * whether the email exists (prevent enumeration attacks).
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password form schema
 *
 * Validates new password with confirmation match.
 * Token is handled separately from the URL.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
