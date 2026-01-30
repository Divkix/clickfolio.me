/**
 * Input sanitization utilities for security and XSS prevention
 * Designed to work in Cloudflare Workers environment (no DOM available)
 */

// Pre-compiled regex and lookup table for sanitizeText (single-pass optimization)
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};
const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

/**
 * Sanitizes plain text by removing/encoding dangerous HTML characters
 * Prevents XSS attacks by encoding special characters
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input.replace(HTML_ESCAPE_REGEX, (char) => HTML_ENTITIES[char]);
}

/**
 * Sanitizes and validates URLs
 * Only allows http://, https://, and mailto: protocols
 * Blocks javascript:, data:, and other dangerous protocols
 */
export function sanitizeUrl(input: string): string {
  if (!input) return "";

  // Trim and lowercase the protocol check
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:", "about:"];

  for (const protocol of dangerousProtocols) {
    if (lower.startsWith(protocol)) {
      return "";
    }
  }

  // Allow only safe protocols
  const safeProtocols = ["http://", "https://", "mailto:"];
  const hasProtocol = safeProtocols.some((protocol) => lower.startsWith(protocol));

  if (!hasProtocol) {
    // If no protocol, assume https://
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Validates and sanitizes email addresses
 * Basic format check and special character encoding
 */
export function sanitizeEmail(input: string): string {
  if (!input) return "";

  const trimmed = input.trim().toLowerCase();

  // Lenient email format validation: just needs @ with text on both sides
  // Accepts AI-parsed emails without TLD (e.g., user@university)
  const emailRegex = /^[^\s@]+@[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return "";
  }

  // Remove any dangerous characters
  return trimmed.replace(/[<>'"]/g, "");
}

/**
 * Validates and sanitizes phone numbers
 * Allows only digits, spaces, hyphens, parentheses, and plus sign
 */
export function sanitizePhone(input: string): string {
  if (!input) return "";

  // Allow only valid phone number characters
  return input.replace(/[^0-9\s\-()+ ]/g, "").trim();
}

// Pre-compiled combined XSS pattern regex (single-pass optimization)
const XSS_PATTERN = /<script|<iframe|javascript:|data:text\/html|\s*on\w+\s*=/i;

/**
 * Checks if a string contains potential XSS patterns
 * Returns true if suspicious content is detected
 */
export function containsXssPattern(input: string): boolean {
  if (!input) return false;
  // Quick check: XSS patterns require '<', ':', or '='
  if (!input.includes("<") && !input.includes(":") && !input.includes("=")) {
    return false;
  }
  return XSS_PATTERN.test(input);
}
