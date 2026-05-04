/**
 * Analytics utility functions — pure, no side effects.
 *
 * Used by the referral tracking system for visitor identification.
 * All functions are deterministic and testable in isolation.
 */

import { sha256Hex } from "./hash";

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

  return sha256Hex(new TextEncoder().encode(input));
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
  return sha256Hex(new TextEncoder().encode(input));
}
