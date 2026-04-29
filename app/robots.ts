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
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
