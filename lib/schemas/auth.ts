/**
 * Authentication validation schemas using Zod
 * Includes strict password requirements and email validation with sanitization
 */

import { z } from 'zod'
import { sanitizeEmail } from '@/lib/utils/sanitization'

/**
 * Password validation regex patterns
 * Enforces strict security requirements for user passwords
 */
const PASSWORD_REGEX = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
}

/**
 * Base email schema with sanitization and validation
 * Transforms email to lowercase and removes dangerous characters
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .transform(sanitizeEmail)
  .refine((email) => email.length > 0, {
    message: 'Email contains invalid characters',
  })

/**
 * Base password schema with strict security requirements
 * Enforces 8+ characters with uppercase, lowercase, number, and special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((password) => PASSWORD_REGEX.uppercase.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => PASSWORD_REGEX.lowercase.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => PASSWORD_REGEX.number.test(password), {
    message: 'Password must contain at least one number',
  })
  .refine((password) => PASSWORD_REGEX.special.test(password), {
    message: 'Password must contain at least one special character (!@#$%^&*)',
  })

/**
 * Login form schema
 * Used for email/password authentication
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

/**
 * Signup form schema
 * Includes password confirmation with matching validation
 */
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Forgot password form schema
 * Only requires email for password reset link
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

/**
 * Reset password form schema
 * Used when user clicks password reset link
 * Includes password confirmation with matching validation
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Magic link form schema
 * For passwordless email authentication
 */
export const magicLinkSchema = z.object({
  email: emailSchema,
})

/**
 * Combined auth schemas object for convenient imports
 * Usage: import { authSchemas } from '@/lib/schemas/auth'
 */
export const authSchemas = {
  login: loginSchema,
  signup: signupSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  magicLink: magicLinkSchema,
} as const

// TypeScript type exports for use in components and API routes

/**
 * Login form data type
 */
export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Signup form data type
 */
export type SignupFormData = z.infer<typeof signupSchema>

/**
 * Forgot password form data type
 */
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

/**
 * Reset password form data type
 */
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

/**
 * Magic link form data type
 */
export type MagicLinkFormData = z.infer<typeof magicLinkSchema>
