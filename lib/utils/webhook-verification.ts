/**
 * Verify Replicate webhook signature using HMAC-SHA256
 * Compatible with Cloudflare Workers (uses crypto.subtle)
 */

import { ENV } from '@/lib/env'

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function verifyReplicateWebhook(request: Request): Promise<{ isValid: boolean; body: string }> {
  const webhookId = request.headers.get('webhook-id')
  const webhookTimestamp = request.headers.get('webhook-timestamp')
  const webhookSignature = request.headers.get('webhook-signature')

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    const missing = [
      !webhookId && 'webhook-id',
      !webhookTimestamp && 'webhook-timestamp',
      !webhookSignature && 'webhook-signature',
    ].filter(Boolean)
    console.error(`Missing webhook headers: ${missing.join(', ')}`)
    return { isValid: false, body: '' }
  }

  // Read body
  const body = await request.text()

  // Check timestamp (prevent replay attacks - 1 min tolerance)
  const now = Math.floor(Date.now() / 1000)
  const timestamp = parseInt(webhookTimestamp, 10)
  if (Math.abs(now - timestamp) > 60) {
    console.error('Webhook timestamp too old')
    return { isValid: false, body }
  }

  // Get secret and remove 'whsec_' prefix
  const secret = ENV.REPLICATE_WEBHOOK_SECRET()
  if (!secret) {
    console.error('REPLICATE_WEBHOOK_SECRET not set')
    return { isValid: false, body }
  }
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret

  // Construct signed content
  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`

  // Decode base64 secret
  let secretBytes: Uint8Array
  try {
    secretBytes = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0))
  } catch {
    console.error('Failed to decode webhook secret')
    return { isValid: false, body }
  }

  // Compute HMAC-SHA256
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent))
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  // Parse webhook-signature header (format: "v1,signature v1,signature2")
  const signatures = webhookSignature.split(' ').map(s => {
    const [version, sig] = s.split(',')
    return { version, sig }
  })

  // Compare signatures using constant-time comparison to prevent timing attacks
  const isValid = signatures.some(({ sig }) => constantTimeCompare(sig, computedSignature))

  return { isValid, body }
}
