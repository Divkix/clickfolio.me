import { describe, expect, it } from "vite-plus/test";
import { siteConfig } from "@/lib/config/site";
import { buildRolePageHead } from "@/lib/seo/json-ld";

describe("role page head", () => {
  it.each([
    ["consultant", "Resume Website for Consultants"],
    ["designer", "Portfolio Website for Designers"],
    ["marketer", "Resume Website for Marketers"],
    ["product-manager", "Portfolio Website for Product Managers"],
    ["software-engineer", "Resume Website for Software Engineers"],
    ["student", "Free Resume Website for Students"],
  ])("preserves public metadata for %s", (slug, title) => {
    const description = "A role-specific portfolio description.";
    const url = `${siteConfig.url}/for/${slug}`;
    const head = buildRolePageHead({ title, description, path: `/for/${slug}` });

    expect(head.links).toEqual([{ rel: "canonical", href: url }]);
    expect(head.meta).toEqual([
      { title: `${title} | ${siteConfig.fullName}` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: siteConfig.fullName },
      { property: "og:image", content: `${siteConfig.url}/api/og/home` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: siteConfig.fullName },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${siteConfig.url}/api/og/home` },
    ]);
  });
});
