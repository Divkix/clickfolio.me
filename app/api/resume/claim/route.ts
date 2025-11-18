import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from '@/lib/r2'

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

    const { key } = await request.json()

    if (!key || !key.startsWith('temp/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    // 2. Rate limiting check (5 uploads per 24 hours)
    const { count, error: countError } = await supabase
      .from('resumes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )

    if (countError) throw countError

    if (count && count >= 5) {
      return NextResponse.json(
        { error: 'Upload limit reached. Maximum 5 uploads per 24 hours.' },
        { status: 429 }
      )
    }

    // 3. Copy object to user's folder
    const timestamp = Date.now()
    const filename = key.split('/').pop()
    const newKey = `users/${user.id}/${timestamp}/${filename}`

    await r2Client.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET,
        CopySource: `${R2_BUCKET}/${key}`,
        Key: newKey,
      })
    )

    // 4. Delete temp object
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    )

    // 5. Insert into database
    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        r2_key: newKey,
        status: 'pending_claim',
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ resume_id: resume.id })
  } catch (error) {
    console.error('Error claiming resume:', error)
    return NextResponse.json(
      { error: 'Failed to claim resume' },
      { status: 500 }
    )
  }
}
