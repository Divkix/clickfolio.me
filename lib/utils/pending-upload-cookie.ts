import { z } from "zod";

export const COOKIE_NAME = "pending_upload";

export const COOKIE_MAX_AGE = 30 * 60;

const encoder = new TextEncoder();

// The key is imported on every call: a derived key is cheap to rebuild, and nothing that holds
// the secret may outlive its request.
function getCryptoKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
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

// `<tempKey>|<expiresAt ms>|<signature>`; the key never contains `|`, so any other shape is forged.
const signedCookieSchema = z
  .string()
  .transform((value) => value.split("|"))
  .pipe(z.tuple([z.string().min(1), z.string().regex(/^\d+$/), z.string().min(1)]));

/**
 * `cookies().set()` percent-encodes the value (`|` becomes `%7C`) and the raw Cookie header
 * keeps that encoding. Null when the value is not valid percent-encoding.
 */
export function decodePendingUploadCookie(rawValue: string): string | null {
  const decoded = z
    .string()
    .transform((value, ctx) => {
      try {
        return decodeURIComponent(value);
      } catch {
        ctx.issues.push({ code: "custom", message: "malformed percent-encoding", input: value });

        return z.NEVER;
      }
    })
    .safeParse(rawValue);

  return decoded.success ? decoded.data : null;
}

export async function parseSignedCookieValue(
  cookieValue: string,
  secret: string,
): Promise<ParsedPendingUpload | null> {
  const parts = signedCookieSchema.safeParse(cookieValue);

  if (!parts.success) return null;

  const [tempKey, expiresAtStr, signature] = parts.data;

  if (Date.now() > Number(expiresAtStr)) return null;

  const isValid = await verifySignature(`${tempKey}|${expiresAtStr}`, signature, secret);

  if (!isValid) return null;

  return { tempKey };
}
