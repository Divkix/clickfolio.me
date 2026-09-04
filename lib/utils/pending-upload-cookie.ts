export const COOKIE_NAME = "pending_upload";
export const COOKIE_MAX_AGE = 30 * 60;

const encoder = new TextEncoder();

const keyCache = new Map<string, CryptoKey>();

export function clearKeyCache(): void {
  keyCache.clear();
}

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

async function signValue(value: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifySignature(value: string, signature: string, secret: string): Promise<boolean> {
  const expected = await signValue(value, secret);

  if (signature.length !== expected.length) return false;

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

export async function createSignedCookieValue(tempKey: string, secret: string): Promise<string> {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${tempKey}|${expiresAt}`;
  const signature = await signValue(payload, secret);
  return `${payload}|${signature}`;
}

interface ParsedPendingUpload {
  tempKey: string;
}

export async function parseSignedCookieValue(
  cookieValue: string,
  secret: string,
): Promise<ParsedPendingUpload | null> {
  const parts = cookieValue.split("|");

  if (parts.length !== 3) {
    return null;
  }

  const [tempKey, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  const payload = `${tempKey}|${expiresAtStr}`;
  const isValid = await verifySignature(payload, signature, secret);

  if (!isValid) {
    return null;
  }

  return {
    tempKey,
  };
}
