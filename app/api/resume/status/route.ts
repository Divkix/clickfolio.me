import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getParseStatus, normalizeResumeData } from '@/lib/replicate'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get resume_id from query params
    const { searchParams } = new URL(request.url)
    const resumeId = searchParams.get('resume_id')

    if (!resumeId) {
      return NextResponse.json({ error: 'Missing resume_id parameter' }, { status: 400 })
    }

    // 3. Fetch resume from database
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, user_id, status, replicate_job_id, error_message, retry_count')
      .eq('id', resumeId)
      .single()

    if (fetchError || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // 4. Verify ownership
    if (resume.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 5. If not processing, return current status
    if (resume.status !== 'processing') {
      return NextResponse.json({
        status: resume.status,
        progress_pct: resume.status === 'completed' ? 100 : 0,
        error: resume.error_message,
        can_retry: resume.status === 'failed' && resume.retry_count < 2,
      })
    }

    // 6. Check if we have a replicate job ID
    if (!resume.replicate_job_id) {
      return NextResponse.json({
        status: 'processing',
        progress_pct: 10,
        error: null,
        can_retry: false,
      })
    }

    // 7. Poll Replicate for status
    let prediction
    try {
      prediction = await getParseStatus(resume.replicate_job_id)
    } catch (error) {
      console.error('Replicate API error:', error)
      // Return processing status on network errors - client will retry
      return NextResponse.json({
        status: 'processing',
        progress_pct: 30,
        error: null,
        can_retry: false,
      })
    }

    // 8. Handle Replicate status
    if (prediction.status === 'succeeded') {
      try {
        // Extract and normalize data
        if (!prediction.output?.extraction_schema_json) {
          throw new Error('Missing extraction_schema_json in Replicate output')
        }

        const normalizedContent = normalizeResumeData(prediction.output.extraction_schema_json)

        // Upsert to site_data (ON CONFLICT user_id DO UPDATE)
        // TypeScript workaround: JSON parse/stringify to satisfy Json type
        const { error: upsertError } = await supabase.from('site_data').upsert(
          {
            user_id: user.id,
            resume_id: resumeId,
            content: JSON.parse(JSON.stringify(normalizedContent)),
            theme_id: 'minimalist_creme',
            last_published_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )

        if (upsertError) throw upsertError

        // Update resume status
        const { error: updateError } = await supabase
          .from('resumes')
          .update({
            status: 'completed',
            parsed_at: new Date().toISOString(),
          })
          .eq('id', resumeId)

        if (updateError) throw updateError

        return NextResponse.json({
          status: 'completed',
          progress_pct: 100,
          error: null,
          can_retry: false,
        })
      } catch (error) {
        console.error('Error processing Replicate output:', error)

        // Mark as failed
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to process AI output'

        await supabase
          .from('resumes')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', resumeId)

        return NextResponse.json({
          status: 'failed',
          progress_pct: 0,
          error: errorMessage,
          can_retry: resume.retry_count < 2,
        })
      }
    } else if (prediction.status === 'failed' || prediction.status === 'canceled' || prediction.status === 'aborted') {
      // Mark as failed
      const errorMessage = prediction.error || 'AI parsing failed'

      const { error: updateError } = await supabase
        .from('resumes')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', resumeId)

      if (updateError) {
        console.error('Failed to update resume status:', updateError)
      }

      return NextResponse.json({
        status: 'failed',
        progress_pct: 0,
        error: errorMessage,
        can_retry: resume.retry_count < 2,
      })
    } else {
      // Still processing or starting
      const progressMap: Record<string, number> = {
        starting: 20,
        processing: 50,
      }

      return NextResponse.json({
        status: 'processing',
        progress_pct: progressMap[prediction.status] || 30,
        error: null,
        can_retry: false,
      })
    }
  } catch (error) {
    console.error('Error checking resume status:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
