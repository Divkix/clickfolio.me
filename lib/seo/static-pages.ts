import type { MetadataRoute } from "next";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export interface StaticPage {
  path: string;
  /** Link text used by llms.txt / llms-full.txt. */
  label: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/**
 * Indexable pages that are neither blog posts nor `/for/*` role pages. The sitemap and the
 * llms.txt files both read this list, so a new public page is added here once.
 */
export const STATIC_PAGES: readonly StaticPage[] = [
  { path: "/", label: "Homepage", changeFrequency: "daily", priority: 1.0 },
  { path: "/explore", label: "Browse Portfolios", changeFrequency: "daily", priority: 0.9 },
  { path: "/blog", label: "Blog", changeFrequency: "weekly", priority: 0.8 },
  {
    path: "/templates",
    label: "Resume Website Templates",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  { path: "/about", label: "About", changeFrequency: "monthly", priority: 0.5 },
  { path: "/faq", label: "FAQ", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", label: "Contact and Support", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy", label: "Privacy Policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", label: "Terms of Service", changeFrequency: "yearly", priority: 0.3 },
];
