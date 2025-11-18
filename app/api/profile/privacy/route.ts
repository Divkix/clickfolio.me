import { createClient } from '@/lib/supabase/server'
import { privacySettingsSchema } from '@/lib/schemas/profile'
import { NextResponse } from 'next/server'

/**
 * PUT /api/profile/privacy
 * Update user's privacy settings (show_phone, show_address)
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to update privacy settings' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = privacySettingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid privacy settings data',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { show_phone, show_address } = validation.data

    // Update privacy_settings JSONB column
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        privacy_settings: {
          show_phone,
          show_address,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('privacy_settings')
      .single()

    if (updateError) {
      console.error('Privacy settings update error:', updateError)
      return NextResponse.json(
        {
          error: 'Database Error',
          message: 'Failed to update privacy settings',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      privacy_settings: data.privacy_settings,
    })
  } catch (err) {
    console.error('Unexpected error in privacy update:', err)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
