import { createClient } from '@/lib/supabase/server'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { parseResume } from '@/lib/replicate'
import { enforceRateLimit } from '@/lib/utils/rate-limit'
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from '@/lib/utils/security-headers'
import {
  validatePDFMagicNumber,
  validateRequestSize,
  MAX_FILE_SIZE,
} from '@/lib/utils/validation'

/**
 * POST /api/resume/claim
 * Claims an anonymous upload and triggers AI parsing
 * Rate limit: 5 uploads per 24 hours
 */
export async function POST(request: Request) {
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

    // 2. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(
        'You must be logged in to claim a resume',
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

    const { key } = body

    if (!key || !key.startsWith('temp/')) {
      return createErrorResponse(
        'Invalid upload key. Must be a temporary upload.',
        ERROR_CODES.VALIDATION_ERROR,
        400
      )
    }

    // 4. Rate limiting check (5 uploads per 24 hours)
    const rateLimitResponse = await enforceRateLimit(user.id, 'resume_upload')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // 5. Validate file size (10MB limit)
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
      const headResponse = await r2Client.send(headCommand)

      if (
        headResponse.ContentLength &&
        headResponse.ContentLength > MAX_FILE_SIZE
      ) {
        return createErrorResponse(
          `File size exceeds 10MB limit (${Math.round(headResponse.ContentLength / 1024 / 1024)}MB)`,
          ERROR_CODES.VALIDATION_ERROR,
          400
        )
      }
    } catch (error) {
      console.error('File size validation error:', error)
      return createErrorResponse(
        'Failed to validate file. The file may have expired.',
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500
      )
    }

    // 6. Validate PDF magic number before processing
    const pdfValidation = await validatePDFMagicNumber(r2Client, R2_BUCKET, key)
    if (!pdfValidation.valid) {
      return createErrorResponse(
        pdfValidation.error || 'Invalid PDF file',
        ERROR_CODES.VALIDATION_ERROR,
        400
      )
    }

    // 7. Copy object to user's folder
    const timestamp = Date.now()
    const filename = key.split('/').pop()
    const newKey = `users/${user.id}/${timestamp}/${filename}`

    try {
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET,
          CopySource: `${R2_BUCKET}/${key}`,
          Key: newKey,
        })
      )
    } catch (error) {
      console.error('R2 copy error:', error)
      return createErrorResponse(
        'Failed to process upload. The file may have expired.',
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500
      )
    }

    // 8. Delete temp object
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      )
    } catch (error) {
      console.error('R2 delete error:', error)
      // Continue - not critical if temp file cleanup fails
    }

    // 9. Insert into database with pending_claim status first
    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        r2_key: newKey,
        status: 'pending_claim',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return createErrorResponse(
        'Failed to create resume record. Please try again.',
        ERROR_CODES.DATABASE_ERROR,
        500
      )
    }

    // 10. Generate presigned URL for Replicate (7 day expiry)
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: newKey,
    })

    let presignedUrl: string
    try {
      presignedUrl = await getSignedUrl(r2Client, getCommand, {
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      })
    } catch (error) {
      console.error('Presigned URL generation error:', error)
      return createErrorResponse(
        'Failed to prepare file for processing',
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500
      )
    }

    // 11. Trigger Replicate parsing
    let replicateJobId: string | null = null
    let parseError: string | null = null

    try {
      const prediction = await parseResume(presignedUrl)
      replicateJobId = prediction.id
    } catch (error) {
      console.error('Failed to trigger Replicate parsing:', error)
      parseError =
        error instanceof Error ? error.message : 'Failed to start AI parsing'
    }

    // 12. Update resume with replicate job ID or error
    const updatePayload: {
      status: 'processing' | 'failed'
      replicate_job_id?: string
      error_message?: string
    } = replicateJobId
      ? {
          status: 'processing',
          replicate_job_id: replicateJobId,
        }
      : {
          status: 'failed',
          error_message: parseError || 'Unknown error',
        }

    const { error: updateError } = await supabase
      .from('resumes')
      .update(updatePayload)
      .eq('id', resume.id)

    if (updateError) {
      console.error('Failed to update resume with replicate job:', updateError)
      // Continue anyway - status endpoint will handle it
    }

    return createSuccessResponse({
      resume_id: resume.id,
      status: updatePayload.status,
    })
  } catch (error) {
    console.error('Error claiming resume:', error)
    return createErrorResponse(
      'An unexpected error occurred while claiming your resume',
      ERROR_CODES.INTERNAL_ERROR,
      500
    )
  }
}
