import { createClient } from '@/lib/supabase/server'
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from '@/lib/utils/security-headers'

const VALID_THEMES = ['bento', 'glass', 'minimalist_editorial', 'neo_brutalist'] as const
type ValidTheme = (typeof VALID_THEMES)[number]

function isValidTheme(theme: string): theme is ValidTheme {
  return VALID_THEMES.includes(theme as ValidTheme)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(
        'You must be logged in to update theme',
        ERROR_CODES.UNAUTHORIZED,
        401
      )
    }

    // Parse request body
    const body = await request.json()
    const { theme_id } = body

    // Validate theme_id
    if (!theme_id || typeof theme_id !== 'string') {
      return createErrorResponse(
        'theme_id is required and must be a string',
        ERROR_CODES.BAD_REQUEST,
        400
      )
    }

    if (!isValidTheme(theme_id)) {
      return createErrorResponse(
        'Invalid theme_id provided',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { valid_themes: VALID_THEMES }
      )
    }

    // Update site_data theme_id
    const { data, error: updateError } = await supabase
      .from('site_data')
      .update({
        theme_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('theme_id')
      .single()

    if (updateError) {
      console.error('Failed to update theme:', updateError)

      // Check if site_data doesn't exist yet
      if (updateError.code === 'PGRST116') {
        return createErrorResponse(
          'Resume data not found. Please upload a resume first.',
          ERROR_CODES.NOT_FOUND,
          404
        )
      }

      return createErrorResponse(
        'Failed to update theme. Please try again.',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    return createSuccessResponse({
      success: true,
      theme_id: data.theme_id,
      message: 'Theme updated successfully',
    })
  } catch (error) {
    console.error('Theme update error:', error)
    return createErrorResponse(
      'An unexpected error occurred while updating theme',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
