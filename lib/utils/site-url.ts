import { siteConfig } from "@/lib/config/site";

const DEFAULT_PUBLIC_SITE_URL = siteConfig.url;

export function getPublicSiteUrl(): string {
  return (process.env.APP_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}
