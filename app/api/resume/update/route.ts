import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resumeContentSchema } from '@/lib/schemas/resume'

/**
 * PUT /api/resume/update
 * Updates the user's resume content in site_data
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
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()

    const validation = resumeContentSchema.safeParse(body.content)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const content = validation.data

    // Update site_data
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
      return NextResponse.json(
        { error: 'Failed to update resume' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        content: data.content,
        last_published_at: data.last_published_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in resume update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
