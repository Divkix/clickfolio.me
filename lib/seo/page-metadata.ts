import { siteConfig } from "@/lib/config/site";
import { TEMPLATE_COUNT } from "@/lib/templates/theme-ids";
import { absoluteSiteUrl } from "@/lib/utils/site-url";

type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/** What a route's `head()` returns; nested routes override meta by `name`/`property`. */
export interface PageHead {
  meta: MetaTag[];
  links: Array<{ rel: string; href: string }>;
}

interface SocialCard {
  title: string;
  description: string;
  url: string;
  type: "website" | "article" | "profile";
  image: { url: string; width: number; height: number; alt: string; type: string };
  /** Extra Open Graph properties, e.g. `profile:username` or `article:published_time`. */
  properties?: Record<string, string>;
}

export const NOINDEX = "noindex, nofollow";

export const NOINDEX_FOLLOW = "noindex, follow";

const HOME_OG_IMAGE = {
  url: `${siteConfig.url}/api/og/home`,
  width: 1200,
  height: 630,
  alt: siteConfig.fullName,
  type: "image/png",
};

const HOME_TITLE = `Free Resume Website Builder — ${siteConfig.fullName}`;

const HOME_DESCRIPTION = `Turn your PDF resume or LinkedIn into a portfolio with ${TEMPLATE_COUNT} free templates and a custom @handle URL. Upload first; create a free account to publish.`;

/** Search results truncate titles past ~60 chars; see `titleTag`. */
export const MAX_TITLE_LENGTH = 60;

const TITLE_SUFFIX = ` | ${siteConfig.fullName}`;

/**
 * The `<title>` text for `title`: ` | clickfolio.me` is appended only when the result still fits
 * in `MAX_TITLE_LENGTH` so the page's own words aren't cut off.
 */
export function titleTag(title: string): string {
  const branded = `${title}${TITLE_SUFFIX}`;

  return branded.length <= MAX_TITLE_LENGTH ? branded : title;
}

/**
 * The head of one page. `title` is the exact `<title>` text (pass it through `titleTag` for the
 * branded form); omitted fields fall back to the root route's tags.
 */
export function pageHead(input: {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string;
  social?: SocialCard;
  links?: PageHead["links"];
}): PageHead {
  const meta: MetaTag[] = [{ title: input.title }];
  const links = [...(input.links ?? [])];

  if (input.description) meta.push({ name: "description", content: input.description });

  if (input.robots) meta.push({ name: "robots", content: input.robots });

  if (input.canonical) links.unshift({ rel: "canonical", href: input.canonical });

  const social = input.social;

  if (social) {
    const og = {
      "og:title": social.title,
      "og:description": social.description,
      "og:type": social.type,
      "og:url": social.url,
      "og:site_name": siteConfig.fullName,
      "og:image": social.image.url,
      "og:image:width": String(social.image.width),
      "og:image:height": String(social.image.height),
      "og:image:alt": social.image.alt,
      "og:image:type": social.image.type,
      ...social.properties,
    } satisfies Record<string, string>;

    for (const [property, content] of Object.entries(og)) meta.push({ property, content });

    meta.push(
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: social.title },
      { name: "twitter:description", content: social.description },
      { name: "twitter:image", content: social.image.url },
    );
  }

  return { meta, links };
}

/** Head for the homepage, with its canonical URL set to `/`. */
export const HOME_HEAD = pageHead({
  title: `Free Resume Website Builder — PDF to Website | ${siteConfig.fullName}`,
  description: HOME_DESCRIPTION,
  canonical: siteConfig.url,
  social: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    url: siteConfig.url,
    image: HOME_OG_IMAGE,
  },
});

/** Head for a signed-in or admin page: never indexed. */
export function privatePageHead(title?: string): PageHead {
  return {
    meta: [...(title ? [{ title: titleTag(title) }] : []), { name: "robots", content: NOINDEX }],
    links: [],
  };
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

export function publicPageHead(params: {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogType?: "website" | "article";
  robots?: string;
}): PageHead {
  const url = absoluteSiteUrl(params.path);
  const { description } = params;

  return pageHead({
    title: titleTag(params.title),
    description,
    canonical: url,
    robots: params.robots,
    social: {
      title: params.ogTitle ?? params.title,
      description,
      type: params.ogType ?? "website",
      url,
      image: HOME_OG_IMAGE,
    },
  });
}
