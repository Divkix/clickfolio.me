/**
 * Site configuration - hardcoded branding constants
 */

const name = "clickfolio";
const tld = ".me";
const domain = "clickfolio.me";

export const siteConfig = {
  /** Main brand name */
  name,
  /** TLD/suffix */
  tld,
  /** Full domain */
  domain,
  /** Combined name + tld */
  fullName: `${name}${tld}`,
  /** Marketing tagline */
  tagline: "Turn your resume into a website",
  /** Support email address */
  supportEmail: "support@clickfolio.me",
  /** Full URL with protocol */
  url: `https://${domain}`,
  /** SEO keywords */
  keywords: [
    "resume website",
    "online portfolio",
    "PDF to website",
    "AI resume parser",
    "professional portfolio",
    "clickfolio",
  ],
} as const;
