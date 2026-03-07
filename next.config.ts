import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],

  experimental: {
    serverActions: {
      bodySizeLimit: `${process.env.MAX_UPLOAD_SIZE_MB || "5"}mb` as `${number}mb`,
    },
  },

  // Rewrites for sitemap index (vinext generateSitemaps doesn't create sitemap index)
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap-index",
      },
      {
        source: "/sitemap/:id.xml",
        destination: "/api/sitemap/:id",
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

  // Security headers for all routes
  async headers() {
    return [
      {
        // CSP: 'unsafe-inline' required for React hydration on Cloudflare Workers (no nonce support in edge middleware)
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
