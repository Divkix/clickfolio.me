/**
 * Canonical list of profession landing pages (`/for/<slug>`).
 *
 * Single source of truth consumed by the homepage "Built for your role" grid
 * (needs display labels) and the sitemap builder (needs slugs + count). Add or
 * remove a role here and both stay in sync.
 */

export interface Profession {
  /** URL slug under /for/. Must match the directory in app/for/. */
  slug: string;
  /** Plural display label for navigation/grids. */
  label: string;
}

export const PROFESSIONS: readonly Profession[] = [
  { slug: "software-engineer", label: "Software Engineers" },
  { slug: "designer", label: "Designers" },
  { slug: "product-manager", label: "Product Managers" },
  { slug: "marketer", label: "Marketers" },
  { slug: "consultant", label: "Consultants" },
  { slug: "student", label: "Students" },
] as const;
