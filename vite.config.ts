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

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
    cloudflareWorkersClientStub(),
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
});
