import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";

/**
 * Vite plugin that stubs `cloudflare:workers` for client environments.
 * Files like lib/referral.ts export both client and server functions;
 * the server-only code imports `cloudflare:workers` which doesn't exist
 * in the browser. This plugin resolves it to an empty stub for client builds.
 */
function cloudflareWorkersClientStub(): Plugin {
  const stubPath = resolve("lib/stubs/cloudflare-workers-client-stub.mjs");
  return {
    name: "cloudflare-workers-client-stub",
    resolveId(id) {
      if (id === "cloudflare:workers" && this.environment?.name === "client") {
        return stubPath;
      }
      return null;
    },
  };
}

/**
 * Vite plugin that extends vinext's client manualChunks to split heavy vendor
 * deps into their own chunks — keeps the main client bundle under 500 KB.
 *
 * vinext intentionally only splits React/scheduler into "framework" and its own
 * shims into "vinext", leaving all other vendor code to Rollup's default splitting.
 * This works well for most apps, but ours pulls radix-ui, react-hook-form, and
 * better-auth into a single mega-chunk. We wrap vinext's function to split those
 * specific packages out while preserving all other vinext chunking decisions.
 */
function clientVendorSplit(): Plugin {
  return {
    name: "client-vendor-split",
    configResolved(config) {
      const clientEnv = config.environments?.client;
      const output = clientEnv?.build?.rollupOptions?.output;
      if (output && typeof output === "object" && !Array.isArray(output)) {
        const original = output.manualChunks;
        output.manualChunks = (id: string, api: unknown) => {
          // Split heavy vendor deps that bloat the client mega-chunk
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
          if (id.includes("node_modules/react-hook-form")) return "vendor-forms";
          if (id.includes("node_modules/better-auth")) return "vendor-auth";
          // Delegate to vinext's default chunking
          if (typeof original === "function") {
            return (original as (id: string, api: unknown) => string | undefined)(id, api);
          }
          return undefined;
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
    cloudflareWorkersClientStub(),
    clientVendorSplit(),
  ],
  resolve: {
    alias: {
      // Bundle stubs — replaces wrangler.jsonc alias block
      // @vercel/og — doesn't work on CF Workers, Next.js bundles it anyway (~2MB)
      "next/dist/compiled/@vercel/og/index.edge.js": resolve("lib/stubs/og-stub.js"),
      // @zxcvbn-ts — password dictionaries (1.73MB), only client-side
      "@zxcvbn-ts/core": resolve("lib/stubs/zxcvbn-core-stub.mjs"),
      "@zxcvbn-ts/language-common": resolve("lib/stubs/zxcvbn-lang-stub.mjs"),
      "@zxcvbn-ts/language-en": resolve("lib/stubs/zxcvbn-lang-stub.mjs"),
      // zod/v3 — Zod v4 compat layer, only dead code path
      "zod/v3": resolve("lib/stubs/zod-v3-stub.mjs"),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // vinext virtual entry imports "middleware" from proxy.ts even though
        // only "proxy" / "default" are used — suppress the harmless warning
        if (
          warning.code === "MISSING_EXPORT" &&
          warning.message?.includes('"middleware"') &&
          warning.message?.includes("proxy.ts")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
