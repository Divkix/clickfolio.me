import { createClient } from '@/lib/supabase/server'
import { SECURITY_HEADERS } from './security-headers'
import { featureFlags } from './config'

/**
 * Rate limiting configuration for different actions
 */
export const RATE_LIMITS = {
  resume_update: { limit: 10, windowHours: 1 },
  privacy_update: { limit: 20, windowHours: 1 },
  handle_change: { limit: 5, windowHours: 24 },
  resume_upload: { limit: 5, windowHours: 24 },
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  message?: string
}

/**
 * Checks if a user has exceeded the rate limit for a specific action
 * Uses Supabase to count actions in the time window
 */
export async function checkRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action]
  const windowMs = config.windowHours * 60 * 60 * 1000
  const windowStart = new Date(Date.now() - windowMs)
  const resetAt = new Date(Date.now() + windowMs)

  const supabase = await createClient()

  try {
    // Determine which table and column to query based on action
    let count = 0

    switch (action) {
      case 'resume_update': {
        const { count: updateCount, error } = await supabase
          .from('site_data')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('updated_at', windowStart.toISOString())

        if (error) throw error
        count = updateCount || 0
        break
      }

      case 'privacy_update': {
        const { count: updateCount, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('id', userId)
          .gte('updated_at', windowStart.toISOString())

        if (error) throw error
        count = updateCount || 0
        break
      }

      case 'handle_change': {
        // TODO: This currently shares counter with privacy_update since both
        // update profiles.updated_at. Consider adding audit_log table for
        // precise tracking. For now, limit is set higher to account for overlap.
        const { count: changeCount, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('id', userId)
          .gte('updated_at', windowStart.toISOString())

        if (error) throw error
        count = changeCount || 0
        break
      }

      case 'resume_upload': {
        const { count: uploadCount, error } = await supabase
          .from('resumes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', windowStart.toISOString())

        if (error) throw error
        count = uploadCount || 0
        break
      }

      default: {
        const _exhaustive: never = action
        throw new Error(`Unknown rate limit action: ${_exhaustive}`)
      }
    }

    const allowed = count < config.limit
    const remaining = Math.max(0, config.limit - count)

    return {
      allowed,
      remaining,
      resetAt,
      message: allowed
        ? undefined
        : `Rate limit exceeded. Maximum ${config.limit} ${action.replace('_', ' ')} per ${config.windowHours} hour(s). Try again later.`,
    }
  } catch (error) {
    console.error(`Rate limit check failed for ${action}:`, error)

    // SECURITY: Fail closed - if we can't verify rate limits, deny the action
    // This prevents abuse during DB outages at the cost of temporary user friction
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message:
        'Rate limiting service temporarily unavailable. Please try again in a few moments.',
    }
  }
}

/**
 * Helper function to enforce rate limits in API routes
 * Returns a Response object if rate limit is exceeded, null otherwise
 */
export async function enforceRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<Response | null> {
  // Skip rate limiting in development
  if (!featureFlags.rateLimiting) {
    return null
  }

  const result = await checkRateLimit(userId, action)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate Limit Exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: result.message,
        details: {
          limit: RATE_LIMITS[action].limit,
          windowHours: RATE_LIMITS[action].windowHours,
          resetAt: result.resetAt.toISOString(),
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...SECURITY_HEADERS,
          'X-RateLimit-Limit': String(RATE_LIMITS[action].limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': result.resetAt.toISOString(),
          'Retry-After': String(
            Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
          ),
        },
      }
    )
  }

  return null
}
