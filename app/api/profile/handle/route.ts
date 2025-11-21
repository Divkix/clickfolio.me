import { createClient } from '@/lib/supabase/server'
import { handleUpdateSchema } from '@/lib/schemas/profile'
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
 * PUT /api/profile/handle
 * Update user's handle (old handle becomes immediately available)
 * Rate limit: 3 handle changes per 24 hours (prevent abuse)
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
    const authResult = await requireAuthWithMessage('You must be logged in to update your handle')
    if (authResult.error) return authResult.error
    const { user } = authResult

    const supabase = await createClient()

    // 3. Check rate limit (3 handle changes per 24 hours)
    const rateLimitResponse = await enforceRateLimit(user.id, 'handle_change')
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

    const validation = handleUpdateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'Invalid handle format',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues
      )
    }

    const { handle: newHandle } = validation.data

    // 5. Fetch current profile to get old handle
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single()

    if (fetchError || !currentProfile) {
      return createErrorResponse(
        'Failed to fetch current profile',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    const oldHandle = currentProfile.handle

    // 6. Check if handle is already the same
    if (oldHandle === newHandle) {
      return createErrorResponse(
        'Handle is already set to this value',
        ERROR_CODES.VALIDATION_ERROR,
        400
      )
    }

    // 7. Check if new handle is already taken by another user
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', newHandle)
      .maybeSingle()

    if (checkError) {
      console.error('Handle uniqueness check error:', checkError)
      return createErrorResponse(
        'Failed to check handle availability',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    if (existingProfile && existingProfile.id !== user.id) {
      return createErrorResponse(
        'This handle is already taken. Please choose a different one.',
        ERROR_CODES.CONFLICT,
        409
      )
    }

    // 8. Update handle in profiles table
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        handle: newHandle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('handle')
      .single()

    if (updateError) {
      console.error('Handle update error:', updateError)
      return createErrorResponse(
        'Failed to update handle. Please try again.',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    // 9. Invalidate cache for both old and new handles
    // Old handle: Clear cached 404 page
    // New handle: Ensure fresh data on first visit
    if (oldHandle) {
      revalidatePath(`/${oldHandle}`)
    }
    revalidatePath(`/${newHandle}`)

    return createSuccessResponse({
      success: true,
      handle: data.handle,
      old_handle: oldHandle,
    })
  } catch (err) {
    console.error('Unexpected error in handle update:', err)
    return createErrorResponse(
      'An unexpected error occurred. Please try again.',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
