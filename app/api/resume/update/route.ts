import { createClient } from '@/lib/supabase/server'
import { resumeContentSchema } from '@/lib/schemas/resume'
import { enforceRateLimit } from '@/lib/utils/rate-limit'
import { validateRequestSize } from '@/lib/utils/validation'
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from '@/lib/utils/security-headers'
import { revalidatePath } from 'next/cache'
import { requireAuthWithMessage } from '@/lib/auth/middleware'

/**
 * PUT /api/resume/update
 * Updates the user's resume content in site_data
 * Includes rate limiting (10 updates per hour) and comprehensive validation
 *
 * Request body:
 * {
 *   content: ResumeContent
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { id, content, last_published_at }
 * }
 */
export async function PUT(request: Request) {
  try {
    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request)
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || 'Request body too large',
        ERROR_CODES.BAD_REQUEST,
        413
      )
    }

    // 2. Authenticate user
    const authResult = await requireAuthWithMessage('You must be logged in to update your resume')
    if (authResult.error) return authResult.error
    const { user } = authResult

    const supabase = await createClient()

    // 3. Check rate limit (10 updates per hour)
    const rateLimitResponse = await enforceRateLimit(user.id, 'resume_update')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // 4. Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return createErrorResponse(
        'Invalid JSON in request body',
        ERROR_CODES.BAD_REQUEST,
        400
      )
    }

    const validation = resumeContentSchema.safeParse(body.content)

    if (!validation.success) {
      return createErrorResponse(
        'Validation failed. Please check your input.',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues
      )
    }

    const content = validation.data

    // 5. Update site_data
    const { data, error } = await supabase
      .from('site_data')
      .update({
        content,
        last_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id, content, last_published_at')
      .single()

    if (error) {
      console.error('Database update error:', error)
      return createErrorResponse(
        'Failed to update resume. Please try again.',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    // 6. Invalidate cache for public resume page
    // Fetch user's handle to revalidate their public page
    const { data: profile } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single()

    if (profile?.handle) {
      // Revalidate the public resume page immediately
      // Next visitor will see updated content
      revalidatePath(`/${profile.handle}`)
    }

    // 7. Return success response
    return createSuccessResponse({
      success: true,
      data: {
        id: data.id,
        content: data.content,
        last_published_at: data.last_published_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in resume update:', error)
    return createErrorResponse(
      'An unexpected error occurred. Please try again.',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
