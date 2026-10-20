import { siteConfig } from "@/lib/config/site";

const DEFAULT_PUBLIC_SITE_URL = siteConfig.url;

export function getPublicSiteUrl(): string {
  return (process.env.APP_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}

/** Canonical URL for a path (JSON-LD, llms.txt); `""` and `"/"` both mean the homepage. */
export function absoluteSiteUrl(path: string): string {
  if (path === "/" || path === "") return siteConfig.url;

  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
