import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";

/**
 * Vite plugin that stubs server-only modules for client environments.
 * - `cloudflare:workers` — used by lib/referral.ts etc., doesn't exist in browser
 * - `node:async_hooks` — vinext's headers.js shim imports AsyncLocalStorage,
 *   which Vite externalizes to a browser stub that lacks the named export
 */
function clientModuleStubs(): Plugin {
  const stubs: Record<string, string> = {
    "cloudflare:workers": resolve("lib/stubs/cloudflare-workers-client-stub.mjs"),
    "node:async_hooks": resolve("lib/stubs/async-hooks-client-stub.mjs"),
    async_hooks: resolve("lib/stubs/async-hooks-client-stub.mjs"),
  };
  return {
    name: "client-module-stubs",
    enforce: "pre",
    resolveId(id) {
      if (this.environment?.name === "client" && stubs[id]) {
        return stubs[id];
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

/**
 * Workaround for vinext cloudflare-build bug: the plugin writes
 * dist/client/_headers via writeFileSync without creating the directory first.
 * This plugin ensures the output directory exists before writeBundle hooks fire.
 * Remove once vinext fixes this upstream.
 */
function ensureClientDir(): Plugin {
  return {
    name: "ensure-client-dir",
    enforce: "pre",
    writeBundle: {
      order: "pre",
      handler() {
        if (this.environment?.name === "client") {
          mkdirSync("dist/client", { recursive: true });
        }
      },
    },
  };
}

export default defineConfig({
  plugins: [
    ensureClientDir(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
    clientModuleStubs(),
    clientVendorSplit(),
  ],
  resolve: {
    alias: {
      // Bundle stubs — replaces wrangler.jsonc alias block
      // @vercel/og — doesn't work on CF Workers, vinext bundles it anyway (~2MB)
      "next/dist/compiled/@vercel/og/index.edge.js": resolve("lib/stubs/og-stub.js"),
      // @zxcvbn-ts — password dictionaries (1.73MB), only client-side
      "@zxcvbn-ts/core": resolve("lib/stubs/zxcvbn-core-stub.mjs"),
      "@zxcvbn-ts/language-common": resolve("lib/stubs/zxcvbn-lang-stub.mjs"),
      "@zxcvbn-ts/language-en": resolve("lib/stubs/zxcvbn-lang-stub.mjs"),
      // zod/v3 — required bundle shim; only the runtime v3 conversion path is dead
      "zod/v3": resolve("lib/stubs/zod-v3-stub.mjs"),
    },
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  build: {
    rollupOptions: {
      plugins: [
        // Bundle visualizer — only runs when ANALYZE=true
        ...(process.env.ANALYZE === "true"
          ? [visualizer({ open: true, gzipSize: true, filename: "dist/stats.html" })]
          : []),
      ],
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
