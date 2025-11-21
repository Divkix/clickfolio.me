import { createClient } from '@/lib/supabase/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client, getR2Bucket } from '@/lib/r2'
import { parseResume } from '@/lib/replicate'
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from '@/lib/utils/security-headers'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(
        'You must be logged in to retry resume parsing',
        ERROR_CODES.UNAUTHORIZED,
        401
      )
    }

    const { resume_id } = await request.json()

    if (!resume_id) {
      return createErrorResponse(
        'resume_id is required in request body',
        ERROR_CODES.BAD_REQUEST,
        400
      )
    }

    // 2. Fetch resume from database
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, user_id, r2_key, status, retry_count')
      .eq('id', resume_id)
      .single()

    if (fetchError || !resume) {
      return createErrorResponse(
        'Resume not found',
        ERROR_CODES.NOT_FOUND,
        404
      )
    }

    // 3. Verify ownership
    if (resume.user_id !== user.id) {
      return createErrorResponse(
        'You do not have permission to retry this resume',
        ERROR_CODES.FORBIDDEN,
        403
      )
    }

    // 4. Verify retry eligibility
    if (resume.status !== 'failed') {
      return createErrorResponse(
        'Can only retry failed resumes',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { current_status: resume.status }
      )
    }

    if (resume.retry_count >= 2) {
      return createErrorResponse(
        'Maximum retry limit reached. Please upload a new resume.',
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        { max_retries: 2, current_retry_count: resume.retry_count }
      )
    }

    // 5. Generate presigned URL for existing R2 file
    const r2Client = getR2Client()
    const R2_BUCKET = getR2Bucket()

    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: resume.r2_key,
    })

    const presignedUrl = await getSignedUrl(r2Client, getCommand, {
      expiresIn: 3600, // 1 hour - sufficient for Replicate to fetch
    })

    // 6. Trigger new Replicate parsing job
    let prediction
    try {
      prediction = await parseResume(presignedUrl)
    } catch (error) {
      console.error('Failed to trigger retry parsing:', error)
      return createErrorResponse(
        `Failed to start retry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500
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

    if (updateError) {
      console.error('Failed to update resume for retry:', updateError)
      return createErrorResponse(
        'Failed to update resume status',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    return createSuccessResponse({
      resume_id: resume.id,
      status: 'processing',
      prediction_id: prediction.id,
      retry_count: resume.retry_count + 1,
    })
  } catch (error) {
    console.error('Error retrying resume parsing:', error)
    return createErrorResponse(
      'An unexpected error occurred while retrying',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
