/**
 * Social share URL generators
 *
 * All functions use URL and URLSearchParams for safe encoding,
 * preventing XSS through automatic URL encoding.
 */

/**
 * Generate Twitter/X share intent URL
 *
 * @param text - The tweet text
 * @param url - The URL to share
 * @returns Encoded Twitter share URL
 *
 * @example
 * generateTwitterShareUrl("Check out my portfolio!", "https://clickfolio.me/john")
 * // => "https://twitter.com/intent/tweet?text=Check%20out%20my%20portfolio!&url=https%3A%2F%2Fclickfolio.me%2Fjohn"
 */
export function generateTwitterShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text,
    url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate LinkedIn share URL
 *
 * @param url - The URL to share
 * @returns Encoded LinkedIn share URL
 *
 * @example
 * generateLinkedInShareUrl("https://clickfolio.me/john")
 * // => "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fclickfolio.me%2Fjohn"
 */
export function generateLinkedInShareUrl(url: string): string {
  const params = new URLSearchParams({
    url,
  });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}

/**
 * Generate WhatsApp share URL
 *
 * @param text - The message text
 * @param url - The URL to share (appended to text)
 * @returns Encoded WhatsApp share URL
 *
 * @example
 * generateWhatsAppShareUrl("Check out my portfolio!", "https://clickfolio.me/john")
 * // => "https://wa.me/?text=Check%20out%20my%20portfolio!%20https%3A%2F%2Fclickfolio.me%2Fjohn"
 */
export function generateWhatsAppShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text: `${text} ${url}`,
  });
  return `https://wa.me/?${params.toString()}`;
}

/**
 * Generate share text for a resume
 *
 * @param name - The person's name
 * @param handle - The person's handle
 * @returns Formatted share text
 */
export function generateShareText(name: string, handle?: string): string {
  const displayName = name || handle || "someone";
  return `Check out ${displayName}'s portfolio`;
}

/**
 * Check if Web Share API is supported
 *
 * @returns true if navigator.share is available
 */
export function isWebShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

/**
 * Share via Web Share API
 *
 * @param data - Share data object
 * @returns Promise that resolves when shared or rejects on error/cancel
 */
export async function webShare(data: { title: string; text: string; url: string }): Promise<void> {
  if (!isWebShareSupported()) {
    throw new Error("Web Share API not supported");
  }
  await navigator.share(data);
}
