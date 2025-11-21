import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client, getR2Bucket } from '@/lib/r2'
import { generateTempKey } from '@/lib/utils/validation'

// Simple in-memory rate limiter for anonymous uploads
// Note: Resets on cold starts. For production, use Cloudflare WAF rules.
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = ipRequestCounts.get(ip)

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: Request) {
  try {
    // Rate limit by IP to prevent abuse
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      'unknown'

    if (!checkIpRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const { filename } = await request.json()

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    if (filename.length > 255) {
      return NextResponse.json(
        { error: 'Filename too long (max 255 characters)' },
        { status: 400 }
      )
    }

    const key = generateTempKey(filename)
    const r2Client = getR2Client()
    const R2_BUCKET = getR2Bucket()

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: 'application/pdf',
      ChecksumAlgorithm: undefined, // Explicitly disable checksums for R2 compatibility
    })

    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // 1 hour
      // Sign content-type and content-length to enforce validation
      signableHeaders: new Set(['content-type', 'content-length']),
      // Prevent hoisting of content-length to enable client-side enforcement
      unhoistableHeaders: new Set(['content-length']),
    })

    return NextResponse.json({ uploadUrl, key })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
