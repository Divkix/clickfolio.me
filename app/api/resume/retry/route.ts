import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { parseResume } from '@/lib/replicate'

export async function POST(request: Request) {
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

    const { resume_id } = await request.json()

    if (!resume_id) {
      return NextResponse.json({ error: 'Missing resume_id' }, { status: 400 })
    }

    // 2. Fetch resume from database
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, user_id, r2_key, status, retry_count')
      .eq('id', resume_id)
      .single()

    if (fetchError || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // 3. Verify ownership
    if (resume.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Verify retry eligibility
    if (resume.status !== 'failed') {
      return NextResponse.json(
        { error: 'Can only retry failed resumes' },
        { status: 400 }
      )
    }

    if (resume.retry_count >= 2) {
      return NextResponse.json(
        { error: 'Maximum retry limit reached (2 attempts)' },
        { status: 429 }
      )
    }

    // 5. Generate presigned URL for existing R2 file
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: resume.r2_key,
    })

    const presignedUrl = await getSignedUrl(r2Client, getCommand, {
      expiresIn: 7 * 24 * 60 * 60, // 7 days
    })

    // 6. Trigger new Replicate parsing job
    let prediction
    try {
      prediction = await parseResume(presignedUrl)
    } catch (error) {
      console.error('Failed to trigger retry parsing:', error)
      return NextResponse.json(
        {
          error: `Failed to start retry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 500 }
      )
    }

    // 7. Update resume with new job ID and incremented retry count
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        status: 'processing',
        replicate_job_id: prediction.id,
        error_message: null,
        retry_count: resume.retry_count + 1,
      })
      .eq('id', resume_id)

    if (updateError) throw updateError

    return NextResponse.json({
      resume_id: resume.id,
      status: 'processing',
      prediction_id: prediction.id,
      retry_count: resume.retry_count + 1,
    })
  } catch (error) {
    console.error('Error retrying resume parsing:', error)
    return NextResponse.json(
      { error: 'Failed to retry parsing' },
      { status: 500 }
    )
  }
}
