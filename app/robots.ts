import type { MetadataRoute } from "next";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://webresume.now";
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/edit/", "/settings/", "/waiting/", "/wizard/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
