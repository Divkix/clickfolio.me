import type { NextConfig } from "next";

// SAFETY: process.env value is string from Node.js env; fallback to default if missing.
const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],

  experimental: {
    serverActions: {
      // SAFETY: `${number}mb` template literal is dynamically built from env var; runtime value is validated by Next.js serverActions limit parser — cast bridges template literal type.
      bodySizeLimit: `${process.env.MAX_UPLOAD_SIZE_MB || "5"}mb` as `${number}mb`,
    },
  },

  // Keeps trailing-slash API paths (e.g. `/base/`) distinct from their bare form.
  skipTrailingSlashRedirect: true,

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
  async redirects() {
    return [
      {
        source:
          "/:handle((?!@|(?:api|_next|admin|about|blog|dashboard|edit|explore|faq|settings|themes|waiting|wizard|privacy|terms|preview|sitemap|for|ws|robots\\.txt|manifest\\.webmanifest|favicon\\.ico)(?![a-z0-9-]))[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])",
        destination: "/@:handle",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        // CSP: 'unsafe-inline' required for React hydration on Cloudflare Workers (no nonce support in proxy layer)
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://s.clickfolio.me https://analytics.divkix.me https://clerk.clickfolio.me https://challenges.cloudflare.com https://*.protect.clerk.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://s.clickfolio.me https://analytics.divkix.me https://accounts.google.com https://clerk.clickfolio.me https://*.protect.clerk.com:* https://cloudflareinsights.com; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
