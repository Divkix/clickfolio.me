import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["*.ngrok-free.app"],

  // Disable Next.js Image optimization (not compatible with Cloudflare Workers)
  images: {
    unoptimized: true,
  },

  // Configure for Cloudflare deployment
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },

  // Exclude packages from automatic bundling (use native require instead)
  // This helps reduce bundle size for Cloudflare Workers
  serverExternalPackages: [
    // @vercel/og is ~2.2MB and not used directly
    "@vercel/og",
    "canvas",
    // sharp is ~256KB and not needed (images.unoptimized: true)
    "sharp",
    "@img/sharp-darwin-arm64",
    "@img/sharp-linux-x64",
  ],

  // Exclude unused files from bundle tracing to reduce worker size
  // Keys are route globs, values are glob patterns to exclude
  outputFileTracingExcludes: {
    "*": [
      // @vercel/og wasm files are ~2.2MB and not used
      "./node_modules/@vercel/og/**/*",
      "./node_modules/canvas/**/*",
      // sharp is not needed (images.unoptimized: true)
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },

  // Edge caching headers for Cloudflare CDN
  // These enable Cloudflare's edge cache to serve responses without hitting the Worker
  async headers() {
    return [
      {
        // Public resume pages - cache at edge for 1 hour, stale-while-revalidate for 1 day
        // Invalidation still works via revalidateTag/revalidatePath (purges origin cache)
        // Edge cache will serve stale while origin revalidates
        source: "/:handle((?!api|_next|dashboard|edit|settings|waiting|wizard|privacy|terms)[^/]+)",
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
    ];
  },
};

export default nextConfig;
