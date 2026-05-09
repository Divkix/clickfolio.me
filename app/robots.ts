import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/utils/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og/"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/edit/",
          "/preview/",
          "/reset-password/",
          "/settings/",
          "/verify-email/",
          "/waiting/",
          "/wizard/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/explore", "/blog"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: ["/", "/explore", "/blog"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/explore", "/blog"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/explore", "/blog"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/explore", "/blog"],
      },
      {
        userAgent: "GoogleOther",
        allow: ["/", "/explore", "/blog"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
