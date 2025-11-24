/**
 * Site configuration - reads from environment variables
 * Change branding by updating NEXT_PUBLIC_* env vars
 */

const name = process.env.NEXT_PUBLIC_SITE_NAME || "webresume";
const tld = process.env.NEXT_PUBLIC_SITE_TLD || ".now";
const domain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "webresume.now";

export const siteConfig = {
  /** Main brand name (e.g., "webresume") */
  name,
  /** TLD/suffix (e.g., ".now") */
  tld,
  /** Full domain (e.g., "webresume.now") */
  domain,
  /** Combined name + tld */
  fullName: `${name}${tld}`,
  /** Marketing tagline */
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE || "Turn your resume into a website",
  /** Support email address */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `support@${domain}`,
  /** Full URL with protocol */
  url: `https://${domain}`,
} as const;
