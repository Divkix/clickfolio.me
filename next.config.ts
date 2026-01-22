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
      bodySizeLimit: "10mb",
    },
  },

  // Exclude packages from automatic bundling (use native require instead)
  // This helps reduce bundle size for Cloudflare Workers
  serverExternalPackages: [
    // @vercel/og is ~2.2MB and not used directly
    "@vercel/og",
    "canvas",
  ],

  // Exclude unused files from bundle tracing to reduce worker size
  // Keys are route globs, values are glob patterns to exclude
  outputFileTracingExcludes: {
    "*": [
      // @vercel/og wasm files are ~2.2MB and not used
      "./node_modules/@vercel/og/**/*",
      "./node_modules/canvas/**/*",
    ],
  },
};

export default nextConfig;
