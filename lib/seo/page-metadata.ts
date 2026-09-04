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
