/**
 * Referral utilities for handling ?ref= parameter tracking
 *
 * Flow:
 * 1. Visitor lands on /?ref={code}
 * 2. Homepage captures and stores ref in localStorage
 * 3. Visitor signs up via OAuth (optional, depends on entry path)
 * 4. During /api/resume/claim, referredBy is written to the new user record
 */

/**
 * localStorage key used to persist the captured referral code client-side.
 */
const REFERRAL_CODE_KEY = "referral_code";

// =============================================================================
// Client-side functions for referral codes
// =============================================================================

/**
 * Store referral code in localStorage (first ref wins)
 *
 * @param code - The referrer's referral code from ?ref= param
 */
export function captureReferralCode(code: string): void {
  if (globalThis.window === undefined) return;

  // First ref wins - don't overwrite existing
  const existing = localStorage.getItem(REFERRAL_CODE_KEY);
  if (!existing && code && code.trim().length > 0) {
    localStorage.setItem(REFERRAL_CODE_KEY, code.trim().toUpperCase());
  }
}

/**
 * Get stored referral code from localStorage
 *
 * @returns The referral code or null
 */
export function getStoredReferralCode(): string | null {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

/**
 * Clear stored referral code from localStorage
 */
export function clearStoredReferralCode(): void {
  if (globalThis.window === undefined) return;
  localStorage.removeItem(REFERRAL_CODE_KEY);
}
