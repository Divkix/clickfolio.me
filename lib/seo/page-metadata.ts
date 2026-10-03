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
  "Turn your PDF resume or LinkedIn into a portfolio website in 30 seconds — 14 free templates, a custom @handle URL, and privacy controls. No signup to start.";

/**
 * Metadata for the homepage, with its canonical URL set to `/`.
 */
export const HOME_METADATA: Metadata = {
  title: {
    absolute: `Free Resume Website Builder — PDF to Website | ${siteConfig.fullName}`,
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

/** Search results truncate titles past ~60 chars; see `fitTitle`. */
export const MAX_TITLE_LENGTH = 60;

const TITLE_SUFFIX = ` | ${siteConfig.fullName}`;

/**
 * The `<title>` text for `title`: the root layout template appends ` | clickfolio.me`, kept only
 * when the result still fits in `MAX_TITLE_LENGTH` so the page's own words aren't cut off.
 */
export function titleTag(title: string): string {
  const branded = `${title}${TITLE_SUFFIX}`;

  return branded.length <= MAX_TITLE_LENGTH ? branded : title;
}

/** Metadata `title` that renders as `titleTag(title)`. */
export function fitTitle(title: string): NonNullable<Metadata["title"]> {
  return titleTag(title) === title ? { absolute: title } : title;
}

/**
 * `/@handle` title: `Name — headline`, keeping only the headline's first `|`/`·`/`•` segment
 * (headlines are often keyword lists) and cutting on a word boundary past `MAX_TITLE_LENGTH`.
 */
export function buildProfileTitle(fullName: string, headline?: string | null): string {
  const lead = headline?.split(/\s+[|·•]\s+/)[0]?.trim();
  const title = lead ? `${fullName} — ${lead}` : fullName;

  if (title.length <= MAX_TITLE_LENGTH) return title;

  if (fullName.length >= MAX_TITLE_LENGTH) return `${fullName.slice(0, MAX_TITLE_LENGTH - 1)}…`;

  const cut = title.slice(0, MAX_TITLE_LENGTH - 1);
  const wordEnd = cut.lastIndexOf(" ");

  // No whole headline word fits after "Name — ".
  if (wordEnd <= fullName.length + 3) return fullName;

  return `${cut.slice(0, wordEnd).replace(/[\s,;:&|·•—-]+$/, "")}…`;
}

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
    title: fitTitle(title),
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
