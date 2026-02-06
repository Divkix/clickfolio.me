/**
 * HTTP-only signed cookie utilities for pending upload flow
 *
 * Replaces fragile sessionStorage with secure, signed cookies that:
 * - Work across tabs (shared storage)
 * - Survive browser restarts (within expiry window)
 * - Are protected from XSS via httpOnly flag
 * - Are tamper-proof via HMAC-SHA256 signature
 *
 * Cookie format: {temp_key}|{expires_timestamp}|{hmac_signature}
 */

export const COOKIE_NAME = "pending_upload";
export const COOKIE_MAX_AGE = 30 * 60; // 30 minutes in seconds

/** Module-level TextEncoder — no reason to recreate per call */
const encoder = new TextEncoder();

/**
 * Module-level CryptoKey cache keyed by the raw secret string.
 * Avoids re-importing the same HMAC key on every sign/verify call.
 * A Map is used so that if the secret ever changes at runtime
 * (e.g. key rotation), we derive a new CryptoKey for the new secret.
 */
const keyCache = new Map<string, CryptoKey>();

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  keyCache.set(secret, key);
  return key;
}

/**
 * Sign a value using HMAC-SHA256 (Cloudflare Workers compatible)
 * Uses Web Crypto API which is available in both browser and Workers
 */
async function signValue(value: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
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
 * Create a signed cookie value containing upload key
 *
 * @param tempKey - The R2 temp key (e.g., "temp/{uuid}/{filename}")
 * @param secret - The signing secret (BETTER_AUTH_SECRET)
 * @returns Signed cookie value ready for storage
 */
export async function createSignedCookieValue(tempKey: string, secret: string): Promise<string> {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${tempKey}|${expiresAt}`;
  const signature = await signValue(payload, secret);
  return `${payload}|${signature}`;
}

/**
 * Parse result from signed cookie
 */
interface ParsedPendingUpload {
  tempKey: string;
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
  // Cookie format: {temp_key}|{expires_timestamp}|{hmac_signature}
  const parts = cookieValue.split("|");

  // Must have exactly 3 parts
  if (parts.length !== 3) {
    return null;
  }

  const [tempKey, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  // Check expiry - reject expired cookies
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  // Verify HMAC signature - reject tampered cookies
  const payload = `${tempKey}|${expiresAtStr}`;
  const isValid = await verifySignature(payload, signature, secret);

  if (!isValid) {
    return null;
  }

  return {
    tempKey,
  };
}
