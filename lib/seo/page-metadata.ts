/**
 * Per-route Open Graph / Twitter metadata for public pages.
 *
 * Root layout only sets `openGraph.siteName` — it must not supply a default
 * image, url, or type. Inner pages that omit those fields would otherwise
 * inherit the homepage card (e.g. About as `twitter:card=summary` with the
 * 1200×630 home image). Every public route should go through this helper
 * (or set the same fields explicitly, as `/` and `/@handle` do).
 */

import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

type PublicOgType = "website" | "article";

/** Homepage OG/Twitter image — `/api/og/home` is a 1200×630 PNG (not SVG). */
export const HOME_OG_IMAGE = {
  url: `${siteConfig.url}/api/og/home`,
  width: 1200,
  height: 630,
  alt: siteConfig.fullName,
  type: "image/png",
} as const;

function canonicalUrl(path: string): string {
  if (path === "/" || path === "") {
    return siteConfig.url;
  }
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Builds title, canonical, Open Graph, and Twitter tags for a public page.
 * `ogTitle` defaults to `title` (document title still goes through the root
 * `%s | clickfolio.me` template unless the caller uses `absolute`).
 */
export function buildPublicPageMetadata(params: {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogType?: PublicOgType;
}): Metadata {
  const url = canonicalUrl(params.path);
  const ogTitle = params.ogTitle ?? params.title;
  const { title, description } = params;
  const ogType = params.ogType ?? "website";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description,
      type: ogType,
      url,
      siteName: siteConfig.fullName,
      images: [HOME_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [HOME_OG_IMAGE.url],
    },
  };
}
