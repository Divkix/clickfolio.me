/**
 * Clipboard utility for copying text to clipboard
 */

/**
 * Copies text to the clipboard.
 * @param text The text to copy
 * @returns Promise resolving to true on success, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // ponytail: legacy execCommand fallback intentionally dropped — app is HTTPS/localhost
  // only, so the async Clipboard API is always available (secure context).
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}
