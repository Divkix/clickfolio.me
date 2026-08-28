import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/utils/site-url";

/** Protected app surfaces — copied onto AI crawler groups (they do not inherit `*`). */
const DISALLOW_PROTECTED = [
  "/admin/",
  "/dashboard/",
  "/edit/",
  "/preview/",
  "/settings/",
  "/waiting/",
  "/wizard/",
] as const;

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "GoogleOther",
] as const;

/**
 * Generates the robots.txt rules for search engine crawlers.
 * Allows public pages and AI crawlers; blocks protected routes.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og/"],
        disallow: [...DISALLOW_PROTECTED],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/explore", "/blog"],
        disallow: [...DISALLOW_PROTECTED],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
