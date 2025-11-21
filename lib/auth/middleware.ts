/**
 * Authentication middleware utilities for API routes
 * Provides reusable authentication helpers to reduce code duplication
 */

import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, ERROR_CODES } from '@/lib/utils/security-headers'
import type { User } from '@supabase/supabase-js'

/**
 * Verifies that the request is authenticated and returns the user
 * @returns Promise containing either the authenticated user or an error response
 */
export async function requireAuth(): Promise<
  | { user: User; error: null }
  | { user: null; error: Response }
> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        user: null,
        error: createErrorResponse(
          'You must be logged in to perform this action',
          ERROR_CODES.UNAUTHORIZED,
          401
        ),
      }
    }

    return { user, error: null }
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return {
      user: null,
      error: createErrorResponse(
        'Authentication failed',
        ERROR_CODES.INTERNAL_ERROR,
        500
      ),
    }
  }
}

/**
 * Helper to require authentication with custom error message
 * @param errorMessage Custom error message for unauthorized access
 * @returns Promise containing either the authenticated user or an error response
 */
export async function requireAuthWithMessage(
  errorMessage: string
): Promise<
  | { user: User; error: null }
  | { user: null; error: Response }
> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        user: null,
        error: createErrorResponse(
          errorMessage,
          ERROR_CODES.UNAUTHORIZED,
          401
        ),
      }
    }

    return { user, error: null }
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return {
      user: null,
      error: createErrorResponse(
        'Authentication failed',
        ERROR_CODES.INTERNAL_ERROR,
        500
      ),
    }
  }
}