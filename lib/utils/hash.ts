/**
 * SHA-256 hash → hex string utility.
 * Used by rate limiting, analytics, claim, and retry flows.
 */
export async function sha256Hex(data: BufferSource): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
