/**
 * XML escaping utilities for sitemap and RSS/feed generation.
 *
 * Prevents XSS and XML injection by escaping reserved characters
 * in text content before embedding into XML documents.
 */

/**
 * Escapes special XML characters to prevent injection and XSS.
 *
 * Replaces `&`, `<`, `>`, `"`, and `'` with their named entities.
 * Used when generating sitemaps and RSS feeds server-side.
 *
 * @param value - Raw string to escape
 * @returns XML-safe escaped string
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
