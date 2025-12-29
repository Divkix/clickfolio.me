/**
 * HTTP-only signed cookie utilities for pending upload flow
 *
 * Replaces fragile sessionStorage with secure, signed cookies that:
 * - Work across tabs (shared storage)
 * - Survive browser restarts (within expiry window)
 * - Are protected from XSS via httpOnly flag
 * - Are tamper-proof via HMAC-SHA256 signature
 *
 * Cookie format: {temp_key}|{file_hash}|{expires_timestamp}|{hmac_signature}
 */

export const COOKIE_NAME = "pending_upload";
export const COOKIE_MAX_AGE = 30 * 60; // 30 minutes in seconds

/**
 * Sign a value using HMAC-SHA256 (Cloudflare Workers compatible)
 * Uses Web Crypto API which is available in both browser and Workers
 */
async function signValue(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  // Convert to base64 for cookie-safe storage
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify signature using timing-safe comparison to prevent timing attacks
 */
async function verifySignature(value: string, signature: string, secret: string): Promise<boolean> {
  const expected = await signValue(value, secret);

  // Timing-safe comparison
  if (signature.length !== expected.length) return false;

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a signed cookie value containing upload key and optional file hash
 *
 * @param tempKey - The R2 temp key (e.g., "temp/{uuid}/{filename}")
 * @param fileHash - Optional SHA-256 hash of the file for deduplication
 * @param secret - The signing secret (BETTER_AUTH_SECRET)
 * @returns Signed cookie value ready for storage
 */
export async function createSignedCookieValue(
  tempKey: string,
  fileHash: string | null,
  secret: string,
): Promise<string> {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${tempKey}|${fileHash || ""}|${expiresAt}`;
  const signature = await signValue(payload, secret);
  return `${payload}|${signature}`;
}

/**
 * Parse result from signed cookie
 */
interface ParsedPendingUpload {
  tempKey: string;
  fileHash: string | null;
}

/**
 * Parse and verify a signed cookie value
 *
 * @param cookieValue - The raw cookie value
 * @param secret - The signing secret (BETTER_AUTH_SECRET)
 * @returns Parsed data if valid and not expired, null otherwise
 */
export async function parseSignedCookieValue(
  cookieValue: string,
  secret: string,
): Promise<ParsedPendingUpload | null> {
  // Cookie format: {temp_key}|{file_hash}|{expires_timestamp}|{hmac_signature}
  const parts = cookieValue.split("|");

  // Must have exactly 4 parts
  if (parts.length !== 4) {
    return null;
  }

  const [tempKey, fileHash, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  // Check expiry - reject expired cookies
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  // Verify HMAC signature - reject tampered cookies
  const payload = `${tempKey}|${fileHash}|${expiresAtStr}`;
  const isValid = await verifySignature(payload, signature, secret);

  if (!isValid) {
    return null;
  }

  return {
    tempKey,
    fileHash: fileHash || null,
  };
}
