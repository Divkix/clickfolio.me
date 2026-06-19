/**
 * Editorial author persona for blog content.
 *
 * This is a brand persona — a consistent byline that represents the clickfolio.me
 * careers editorial desk, not a claim about a single private individual. It exists
 * to give content a stable, accountable voice and to satisfy E-E-A-T / author
 * attribution signals for search and AI engines. Keep the described expertise
 * honest: it reflects what the team actually does (reviewing resumes, portfolios,
 * and the resume-to-website workflow), with no fabricated employment history.
 */

import { siteConfig } from "@/lib/config/site";

export const authorPersona = {
  /** Byline name shown on posts. */
  name: "The clickfolio Careers Desk",
  /** Short role descriptor. */
  role: "Careers & Portfolio Editorial Team",
  /** Honest one-line bio (no fabricated credentials). */
  bio: "The clickfolio Careers Desk is the editorial team behind clickfolio.me. We test resume and portfolio tools hands-on, study how recruiters read profiles, and write practical guides on turning a resume into a website that gets noticed.",
  /** Canonical URL representing the author entity. */
  url: `${siteConfig.url}/about`,
} as const;
