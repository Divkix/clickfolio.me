/**
 * Input sanitization utilities for security and XSS prevention
 * Designed to work in Cloudflare Workers environment (no DOM available)
 */

/**
 * Sanitizes plain text by removing/encoding dangerous HTML characters
 * Prevents XSS attacks by encoding special characters
 */
export function sanitizeText(input: string): string {
  if (!input) return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitizes and validates URLs
 * Only allows http://, https://, and mailto: protocols
 * Blocks javascript:, data:, and other dangerous protocols
 */
export function sanitizeUrl(input: string): string {
  if (!input) return ''

  // Trim and lowercase the protocol check
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ]

  for (const protocol of dangerousProtocols) {
    if (lower.startsWith(protocol)) {
      return ''
    }
  }

  // Allow only safe protocols
  const safeProtocols = ['http://', 'https://', 'mailto:']
  const hasProtocol = safeProtocols.some((protocol) =>
    lower.startsWith(protocol)
  )

  if (!hasProtocol) {
    // If no protocol, assume https://
    return `https://${trimmed}`
  }

  return trimmed
}

/**
 * Validates and sanitizes email addresses
 * Basic format check and special character encoding
 */
export function sanitizeEmail(input: string): string {
  if (!input) return ''

  const trimmed = input.trim().toLowerCase()

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return ''
  }

  // Remove any dangerous characters
  return trimmed.replace(/[<>'"]/g, '')
}


/**
 * Validates and sanitizes phone numbers
 * Allows only digits, spaces, hyphens, parentheses, and plus sign
 */
export function sanitizePhone(input: string): string {
  if (!input) return ''

  // Allow only valid phone number characters
  return input.replace(/[^0-9\s\-()+ ]/g, '').trim()
}


/**
 * Checks if a string contains potential XSS patterns
 * Returns true if suspicious content is detected
 */
export function containsXssPattern(input: string): boolean {
  if (!input) return false

  // Check for script tags
  if (/<script/i.test(input)) return true

  // Check for javascript: protocol
  if (/javascript:/i.test(input)) return true

  // Check for event handlers
  if (/\s*on\w+\s*=/i.test(input)) return true

  // Check for data: protocol (can be used for XSS)
  if (/data:text\/html/i.test(input)) return true

  // Check for iframe tags
  if (/<iframe/i.test(input)) return true

  return false
}

