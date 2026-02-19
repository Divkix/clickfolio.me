/**
 * Disposable email domain checker
 *
 * Uses a KV-backed blocklist of ~7,000 disposable domains, synced daily from GitHub.
 * Hard-coded trusted domain allowlist skips KV checks for major providers.
 * Fails open on any infrastructure failure — email verification is the safety net.
 */

export interface DisposableCheckResult {
  disposable: boolean;
}

/**
 * Major email providers that are never disposable.
 * Checked before KV lookup to avoid unnecessary reads.
 */
export const TRUSTED_DOMAINS: ReadonlySet<string> = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "outlook.co.uk",
  "hotmail.co.uk",
  "live.co.uk",
  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "yahoo.ca",
  "yahoo.com.au",
  "ymail.com",
  "rocketmail.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // ProtonMail
  "protonmail.com",
  "proton.me",
  "pm.me",
  // Fastmail
  "fastmail.com",
  "fastmail.fm",
  // Zoho
  "zoho.com",
  "zohomail.com",
  // AOL
  "aol.com",
  // GMX
  "gmx.com",
  "gmx.net",
  "gmx.de",
  // Mail.com
  "mail.com",
  "email.com",
  // Tutanota
  "tutanota.com",
  "tuta.io",
  // ISP mail
  "comcast.net",
  "verizon.net",
  "att.net",
  "cox.net",
  "charter.net",
  // India
  "rediffmail.com",
  // Russia/CIS
  "yandex.com",
  "yandex.ru",
  "mail.ru",
]);

/**
 * Extract domain from email address.
 * Uses lastIndexOf("@") to handle edge cases like user@@domain.com.
 * Returns null for invalid formats — let Zod handle format validation.
 */
export function extractDomain(email: string): string | null {
  if (!email) return null;
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return null;
  const domain = email.slice(atIndex + 1).toLowerCase();
  return domain.length > 0 ? domain : null;
}

// Module-level cache for domain blocklist
let cachedDomains: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reset the module-level domain cache.
 * Exposed for testing only.
 */
export function _resetCache(): void {
  cachedDomains = null;
  cacheTimestamp = 0;
}

/**
 * Check if an email address uses a disposable domain.
 *
 * Lookup flow:
 * 1. Extract domain → null returns { disposable: false } (let Zod handle format)
 * 2. Check TRUSTED_DOMAINS Set → early return, zero KV calls
 * 3. If KV is null → fail open
 * 4. Load domain list from KV into cached Set (1hr TTL)
 * 5. Check cachedDomains.has(domain) → return result
 *
 * Fails open on any error. Email verification is the safety net.
 */
export async function isDisposableEmail(
  email: string,
  kv: KVNamespace | null,
): Promise<DisposableCheckResult> {
  const domain = extractDomain(email);
  if (!domain) return { disposable: false };

  // Trusted domains skip KV entirely
  if (TRUSTED_DOMAINS.has(domain)) return { disposable: false };

  // No KV binding → fail open
  if (!kv) return { disposable: false };

  try {
    const now = Date.now();

    // Refresh cache if expired or missing
    if (!cachedDomains || now - cacheTimestamp > CACHE_TTL_MS) {
      const raw = await kv.get("disposable-domains");
      if (!raw) return { disposable: false };

      const domains: string[] = JSON.parse(raw);
      cachedDomains = new Set(domains);
      cacheTimestamp = now;
    }

    return { disposable: cachedDomains.has(domain) };
  } catch (error) {
    console.error("[DISPOSABLE_CHECK] KV lookup failed, failing open:", error);
    return { disposable: false };
  }
}
