import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeResumeData } from '@/lib/replicate'
import { verifyReplicateWebhook } from '@/lib/utils/webhook-verification'

export async function POST(request: Request) {
  try {
    // 1. Verify webhook signature
    const { isValid, body } = await verifyReplicateWebhook(request)

    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response('Unauthorized', { status: 401 })
    }

    // 2. Parse payload
    const payload = JSON.parse(body)
    const { id: replicateJobId, status, output, error } = payload

    console.log(`Webhook received: job=${replicateJobId}, status=${status}`)

    // 3. Only process completed events
    if (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
      return new Response('OK', { status: 200 })
    }

    // 4. Find resume by replicate_job_id (use admin client to bypass RLS)
    const supabase = createAdminClient()
    const { data: resume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, user_id, status')
      .eq('replicate_job_id', replicateJobId)
      .single()

    if (fetchError || !resume) {
      console.error('Resume not found for job:', replicateJobId)
      return new Response('Resume not found', { status: 404 })
    }

    // 5. Skip if already processed (idempotency)
    if (resume.status === 'completed' || resume.status === 'failed') {
      console.log('Resume already processed, skipping')
      return new Response('OK', { status: 200 })
    }

    // 6. Handle success
    if (status === 'succeeded') {
      if (!output?.extraction_schema_json) {
        console.error('Missing extraction_schema_json in output')
        await supabase.from('resumes').update({
          status: 'failed',
          error_message: 'Missing parsed data in Replicate output'
        }).eq('id', resume.id)
        return new Response('OK', { status: 200 })
      }

      const normalizedContent = normalizeResumeData(output.extraction_schema_json)

      // Save to site_data
      const { error: upsertError } = await supabase.from('site_data').upsert({
        user_id: resume.user_id,
        resume_id: resume.id,
        content: JSON.parse(JSON.stringify(normalizedContent)),
        last_published_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (upsertError) {
        console.error('Failed to save site_data:', upsertError)
        await supabase.from('resumes').update({
          status: 'failed',
          error_message: `Database error: ${upsertError.message}`
        }).eq('id', resume.id)
        return new Response('OK', { status: 200 })
      }

      // Update resume status
      await supabase.from('resumes').update({
        status: 'completed',
        parsed_at: new Date().toISOString(),
      }).eq('id', resume.id)

      console.log('Resume processing completed successfully')
    }

    // 7. Handle failure
    else if (status === 'failed' || status === 'canceled') {
      await supabase.from('resumes').update({
        status: 'failed',
        error_message: error || 'AI parsing failed',
      }).eq('id', resume.id)

      console.log('Resume processing failed:', error)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
