import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

type PublicOgType = "website" | "article";

export const HOME_OG_IMAGE = {
  url: `${siteConfig.url}/api/og/home`,
  width: 1200,
  height: 630,
  alt: siteConfig.fullName,
  type: "image/png",
} as const;

const HOME_TITLE = `Free Resume Website Builder — ${siteConfig.fullName}`;

const HOME_DESCRIPTION =
  "Free resume website builder. Turn your PDF resume or LinkedIn into a personal portfolio website in 30 seconds — 12 templates, custom @handle URL, privacy controls. No signup to start.";

/**
 * Shared by `/` and every landing A/B variant route (ADR-0027) — variants are
 * served at `/` via proxy rewrite, so they all canonicalize to the home URL.
 */
export const HOME_METADATA: Metadata = {
  title: {
    absolute: `Free Resume Website Builder — Turn Your PDF Into a Site | ${siteConfig.fullName}`,
  },
  description: HOME_DESCRIPTION,
  alternates: { canonical: siteConfig.url },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    images: [HOME_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [HOME_OG_IMAGE.url],
  },
};

function canonicalUrl(path: string): string {
  if (path === "/" || path === "") {
    return siteConfig.url;
  }

  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

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
