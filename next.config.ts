import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],

  experimental: {
    serverActions: {
      bodySizeLimit: `${process.env.MAX_UPLOAD_SIZE_MB || "5"}mb` as `${number}mb`,
    },
  },

  // Rewrites for sitemap index (Next.js generateSitemaps doesn't create sitemap index)
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap-index",
      },
    ];
  },

  // Redirects for backward compatibility (old /handle URLs to new /@handle URLs)
  async redirects() {
    return [
      {
        // Redirect old /{handle} to /@{handle}
        // Exclude known routes, static files, and paths already starting with @
        source:
          "/:handle((?!@|api|_next|admin|dashboard|edit|explore|settings|themes|waiting|wizard|privacy|terms|reset-password|preview|sitemap|robots\\.txt|manifest\\.webmanifest|favicon\\.ico)[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])",
        destination: "/@:handle",
        permanent: true, // 308 redirect for SEO
      },
    ];
  },

  // Edge caching headers for Cloudflare CDN
  // These enable Cloudflare's edge cache to serve responses without hitting the Worker
  async headers() {
    return [
      {
        // Public resume pages - cache at edge for 1 hour, stale-while-revalidate for 1 day
        // Invalidation still works via revalidateTag/revalidatePath (purges origin cache)
        // Edge cache will serve stale while origin revalidates
        // Matches /@handle format (@ prefix convention)
        source: "/@:handle",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Explore directory page - cache for 5 minutes, stale-while-revalidate for 1 hour
        // Paginated public listing; content changes slowly so short cache is fine
        source: "/explore",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        // Static legal pages - cache aggressively (1 week), these rarely change
        source: "/privacy",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=2592000",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
      {
        source: "/terms",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=2592000",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
      {
        // Homepage - shorter cache since it has dynamic elements
        // Cache shell for 5 minutes, stale-while-revalidate for 1 hour
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        // Security headers for all routes
        // CSP: 'unsafe-inline' required for Next.js hydration on Cloudflare Workers (no nonce support in edge middleware)
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://analytics.divkix.me; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://analytics.divkix.me https://accounts.google.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
