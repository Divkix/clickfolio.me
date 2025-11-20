import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateRequestSize } from '@/lib/utils/validation'
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from '@/lib/utils/security-headers'

export async function POST(request: NextRequest) {
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

    const supabase = await createClient()

    // 2. Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(
        'You must be logged in to setup your profile',
        ERROR_CODES.UNAUTHORIZED,
        401
      )
    }

    // 3. Parse request body
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

    const { handle, privacy_settings } = body

    // 4. Validate handle
    if (!handle || typeof handle !== 'string') {
      return createErrorResponse(
        'Handle is required and must be a string',
        ERROR_CODES.VALIDATION_ERROR,
        400
      )
    }

    const trimmedHandle = handle.trim().toLowerCase()

    // 5. Validate handle length (min 3 chars per schema)
    if (trimmedHandle.length < 3) {
      return createErrorResponse(
        'Handle must be at least 3 characters',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { min_length: 3 }
      )
    }

    // 6. Validate handle format (alphanumeric and hyphens only)
    const handleRegex = /^[a-z0-9-]+$/
    if (!handleRegex.test(trimmedHandle)) {
      return createErrorResponse(
        'Handle can only contain lowercase letters, numbers, and hyphens',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { pattern: '^[a-z0-9-]+$' }
      )
    }

    // 7. Validate privacy settings
    const validatedPrivacySettings = {
      show_phone:
        typeof privacy_settings?.show_phone === 'boolean'
          ? privacy_settings.show_phone
          : false,
      show_address:
        typeof privacy_settings?.show_address === 'boolean'
          ? privacy_settings.show_address
          : false,
    }

    // 8. Check if handle is already taken
    const { data: existingHandle, error: handleCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', trimmedHandle)
      .single()

    if (handleCheckError && handleCheckError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (handle is available)
      console.error('Error checking handle:', handleCheckError)
      return createErrorResponse(
        'Failed to validate handle availability',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    if (existingHandle && existingHandle.id !== user.id) {
      return createErrorResponse(
        'This handle is already taken. Please choose a different one.',
        ERROR_CODES.CONFLICT,
        409,
        { field: 'handle' }
      )
    }

    // 9. Update profile with handle and privacy settings
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        handle: trimmedHandle,
        privacy_settings: validatedPrivacySettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)

      // Handle unique constraint violation
      if (updateError.code === '23505') {
        return createErrorResponse(
          'This handle is already taken. Please choose a different one.',
          ERROR_CODES.CONFLICT,
          409,
          { field: 'handle' }
        )
      }

      return createErrorResponse(
        'Failed to setup profile. Please try again.',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    return createSuccessResponse({
      success: true,
      profile: updatedProfile,
    })
  } catch (error) {
    console.error('Profile setup error:', error)
    return createErrorResponse(
      'An unexpected error occurred during profile setup',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
