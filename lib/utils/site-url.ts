const DEFAULT_PUBLIC_SITE_URL = "https://clickfolio.me";

export function getPublicSiteUrl(): string {
  return process.env.BETTER_AUTH_URL || DEFAULT_PUBLIC_SITE_URL;
}
