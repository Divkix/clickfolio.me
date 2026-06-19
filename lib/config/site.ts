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
  /** Brand alternate spellings for entity recognition (Knowledge Graph). */
  alternateNames: ["clickfolio", "click folio", "Clickfolio"],
  /** Public source repository. */
  githubUrl: "https://github.com/divkix/clickfolio.me",
  /**
   * Verified public profiles for the Organization `sameAs` entity graph.
   * Only the project's own profiles belong here. Personal/maker profiles are
   * modeled on `founder` below (schema-correct), not claimed as the org itself.
   */
  sameAs: ["https://github.com/divkix/clickfolio.me"],
  /**
   * Founder / maker — emitted as the Organization's `founder` Person node.
   * Links the project to a real, verifiable person for entity recognition and
   * E-E-A-T. Profiles sourced from https://divkix.me (no separate brand
   * X/LinkedIn exists yet).
   */
  founder: {
    name: "Divanshu Chauhan",
    url: "https://divkix.me",
    sameAs: [
      "https://divkix.me",
      "https://github.com/divkix",
      "https://www.linkedin.com/in/divkix/",
      "https://x.com/divkix",
      "https://orcid.org/0009-0004-0423-2471",
    ],
  },
} as const;
