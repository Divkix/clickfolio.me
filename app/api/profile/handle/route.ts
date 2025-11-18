import { createClient } from '@/lib/supabase/server'
import { handleUpdateSchema } from '@/lib/schemas/profile'
import { NextResponse } from 'next/server'

/**
 * PUT /api/profile/handle
 * Update user's handle and create redirect from old handle
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
        { error: 'Unauthorized', message: 'You must be logged in to update your handle' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = handleUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid handle format',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { handle: newHandle } = validation.data

    // Fetch current profile to get old handle
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single()

    if (fetchError || !currentProfile) {
      return NextResponse.json(
        {
          error: 'Profile Error',
          message: 'Failed to fetch current profile',
        },
        { status: 500 }
      )
    }

    const oldHandle = currentProfile.handle

    // Check if handle is already the same
    if (oldHandle === newHandle) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Handle is already set to this value',
        },
        { status: 400 }
      )
    }

    // Check if new handle is already taken by another user
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', newHandle)
      .maybeSingle()

    if (checkError) {
      console.error('Handle uniqueness check error:', checkError)
      return NextResponse.json(
        {
          error: 'Database Error',
          message: 'Failed to check handle availability',
        },
        { status: 500 }
      )
    }

    if (existingProfile && existingProfile.id !== user.id) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'This handle is already taken. Please choose a different one.',
        },
        { status: 409 }
      )
    }

    // Create redirect entry if old handle exists
    if (oldHandle) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

      const { error: redirectError } = await supabase
        .from('redirects')
        .insert({
          old_handle: oldHandle,
          new_handle: newHandle,
          expires_at: expiresAt.toISOString(),
        })

      if (redirectError) {
        console.error('Redirect creation error:', redirectError)
        // Continue anyway - redirect is not critical
      }
    }

    // Update handle in profiles table
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
      return NextResponse.json(
        {
          error: 'Database Error',
          message: 'Failed to update handle',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      handle: data.handle,
      old_handle: oldHandle,
      redirect_expires_days: 30,
    })
  } catch (err) {
    console.error('Unexpected error in handle update:', err)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
