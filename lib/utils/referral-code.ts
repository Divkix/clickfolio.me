/**
 * Referral code generation utility
 *
 * Generates permanent, human-readable referral codes using a confusion-resistant
 * alphabet (excludes 0/O/1/I/L to prevent visual confusion).
 *
 * Industry standard: 8-character alphanumeric codes like Uber, Airbnb, Dropbox.
 */

// Confusion-resistant alphabet: no 0/O/1/I/L
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/**
 * Generate a random referral code
 *
 * @returns An 8-character uppercase alphanumeric code
 *
 * @example
 * generateReferralCode() // "ABC123XY"
 */
export function generateReferralCode(): string {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    return Array.from(bytes)
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join("");
  } catch (error) {
    // Fallback to timestamp-based code if crypto fails (very rare)
    console.error("crypto.getRandomValues failed:", error);
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return (timestamp + random).slice(-CODE_LENGTH).padStart(CODE_LENGTH, "A");
  }
}
