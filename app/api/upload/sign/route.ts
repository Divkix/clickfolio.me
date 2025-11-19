import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { generateTempKey } from '@/lib/utils/validation'

export async function POST(request: Request) {
  try {
    const { filename } = await request.json()

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const key = generateTempKey(filename)

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: 'application/pdf',
      ChecksumAlgorithm: undefined, // Explicitly disable checksums for R2 compatibility
    })

    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // 1 hour
      // Only sign essential headers to avoid CORS issues
      signableHeaders: new Set(['content-type', 'content-length']),
      unhoistableHeaders: new Set(['content-length-range']),
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
