/**
 * Analytics utility functions — pure, no side effects.
 *
 * Used by the track API to process incoming beacon data.
 * All functions are deterministic and testable in isolation.
 */

/**
 * Common bot/crawler user-agent patterns.
 * Order: most frequent first for early exit.
 */
const BOT_PATTERNS =
  /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|googlebot|yandexbot|baiduspider|duckduckbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|uptimerobot|pingdom|statuscake|headlesschrome|phantomjs|lighthouse|pagespeed|gtmetrix/i;

/**
 * Detect if a user-agent string belongs to a bot or crawler.
 * Returns true for bots — these should be rejected before DB writes.
 */
export function isBot(ua: string): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_PATTERNS.test(ua);
}

/**
 * Determine device type from user-agent.
 * Checks tablet before mobile because iPad UA contains "Mobile" on some versions.
 */
export function getDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";

  // Tablet detection first (iPad, Android tablet, etc.)
  if (/iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk|PlayBook/i.test(ua)) {
    return "tablet";
  }

  // Mobile detection
  if (
    /Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone/i.test(
      ua,
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

/**
 * Extract hostname from referrer URL, stripping www prefix.
 * Returns null for same-origin referrers, empty/invalid referrers, or direct visits.
 *
 * @param referrer - The full referrer URL from the beacon
 * @param currentHostname - The hostname of the current site (to filter self-referrals)
 */
export function parseReferrerHostname(
  referrer: string | null | undefined,
  currentHostname: string,
): string | null {
  if (!referrer || referrer.trim() === "") return null;

  try {
    const url = new URL(referrer);
    let hostname = url.hostname.toLowerCase();

    // Strip www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    // Strip www. from current hostname for comparison
    let currentHost = currentHostname.toLowerCase();
    if (currentHost.startsWith("www.")) {
      currentHost = currentHost.slice(4);
    }

    // Filter same-origin
    if (hostname === currentHost) return null;

    return hostname;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Generate a privacy-preserving visitor hash.
 * SHA-256(IP + "|" + UA + "|" + YYYY-MM-DD)
 *
 * The daily salt (UTC date) ensures:
 * - Same visitor on same day → same hash (for dedup)
 * - Same visitor on different days → different hash (no long-term tracking)
 * - Raw IP is never stored
 */
export async function generateVisitorHash(ip: string, userAgent: string): Promise<string> {
  const dailySalt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const input = `${ip}|${userAgent}|${dailySalt}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a visitor hash with a specific date.
 * Used for matching clicks across day boundaries (e.g., click yesterday, signup today).
 *
 * @param ip - Visitor IP address
 * @param userAgent - Visitor user agent
 * @param dateStr - Date string in YYYY-MM-DD format
 */
export async function generateVisitorHashWithDate(
  ip: string,
  userAgent: string,
  dateStr: string,
): Promise<string> {
  const input = `${ip}|${userAgent}|${dateStr}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
