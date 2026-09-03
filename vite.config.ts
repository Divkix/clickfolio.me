import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import posthogRollupPlugin from "@posthog/rollup-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import vinext from "vinext";
import { defineConfig, loadEnv, type Plugin } from "vite-plus";

/**
 * Vite plugin that stubs server-only modules for client environments.
 * - `cloudflare:workers` — used by lib/referral.ts etc., doesn't exist in browser
 * - `node:async_hooks` — vinext's headers.js shim imports AsyncLocalStorage,
 *   which Vite externalizes to a browser stub that lacks the named export
 */
function clientModuleStubs(): Plugin {
  const stubs = {
    "cloudflare:workers": resolve("lib/stubs/cloudflare-workers-client-stub.mjs"),
    "node:async_hooks": resolve("lib/stubs/async-hooks-client-stub.mjs"),
    async_hooks: resolve("lib/stubs/async-hooks-client-stub.mjs"),
  } satisfies Record<string, string>;
  return {
    name: "client-module-stubs",
    enforce: "pre",
    resolveId(id) {
      if (this.environment?.name === "client" && id in stubs) {
        // SAFETY: id in stubs guard guarantees id is a key of the stubs record.
        return stubs[id as keyof typeof stubs];
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
 * This works well for most apps, but ours pulls radix-ui and react-hook-form
 * into a single mega-chunk. We wrap vinext's function to split those specific
 * packages out while preserving all other vinext chunking decisions.
 */
function clientVendorSplit(): Plugin {
  return {
    name: "client-vendor-split",
    configResolved(config) {
      const clientEnv = config.environments?.client;
      const output = clientEnv?.build?.rollupOptions?.output;
      if (output && output instanceof Object && !Array.isArray(output)) {
        const original = output.manualChunks;
        output.manualChunks = (id: string, cause: unknown) => {
          // Split heavy vendor deps that bloat the client mega-chunk
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
          if (id.includes("node_modules/react-hook-form")) return "vendor-forms";
          // Delegate to vinext's default chunking
          if (original instanceof Function) {
            // SAFETY: original is Rollup manualChunks from vinext; signature (id: string, cause: unknown) => string | undefined matches our wrapper — cast bridges untyped config.
            return (original as (id: string, cause: unknown) => string | undefined)(id, cause);
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

/**
 * Builds the PostHog source-map upload plugin — ONLY when the deploy script
 * exports POSTHOG_UPLOAD_SOURCEMAPS=true. Ordinary builds (including
 * production builds and dry-runs) never upload, even when credentials exist.
 * Credentials come from Vite env loading (.env* + process.env) and are read
 * only here; they must never be inlined into client output.
 * Missing credentials warn and skip the upload (Cloudflare Builds has no
 * access to the gitignored local deploy env) — add them to the build env to
 * re-enable it. Upload is observability, never a deploy blocker.
 */
function sourceMapUploadPlugin(mode: string): Plugin | null {
  if (process.env.POSTHOG_UPLOAD_SOURCEMAPS !== "true") return null;

  // Empty prefix: load every var from .env* files plus process.env.
  const env = loadEnv(mode, process.cwd(), "");
  if (!env.POSTHOG_API_KEY || !env.POSTHOG_PROJECT_ID) {
    console.warn(
      "[posthog] POSTHOG_UPLOAD_SOURCEMAPS=true but POSTHOG_API_KEY/POSTHOG_PROJECT_ID are missing — skipping source-map upload",
    );
    return null;
  }

  const plugin: unknown = posthogRollupPlugin({
    personalApiKey: env.POSTHOG_API_KEY,
    projectId: env.POSTHOG_PROJECT_ID,
    host: "https://us.posthog.com",
    sourcemaps: {
      enabled: true,
      deleteAfterUpload: true,
      releaseName: "clickfolio",
    },
  });
  // SAFETY: The PostHog plugin uses standard Rollup hooks supported by Vite+'s
  // Rolldown compatibility layer; this bridges only the two packages' contexts.
  return plugin as Plugin;
}

// Shared Oxfmt/Oxlint ignore list (one source).
const SHARED_IGNORE_PATTERNS = [
  "dist/**",
  "lib/cloudflare-env.d.ts",
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "tools/oxlint/anti-slop/**",
];

export default defineConfig(({ mode }) => {
  const sourcemapPlugin = sourceMapUploadPlugin(mode);
  return {
    // Oxfmt: matches previous Biome formatter settings (all defaults already match)
    fmt: {
      ignorePatterns: SHARED_IGNORE_PATTERNS,
    },
    // Oxlint: matches previous Biome linter rule set
    lint: {
      ignorePatterns: SHARED_IGNORE_PATTERNS,
      plugins: ["react", "typescript", "jsx-a11y", "oxc"],
      options: {
        typeAware: true,
        typeCheck: true,
      },
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        "typescript/no-explicit-any": "warn",
        "typescript/no-unused-vars": "error",
        "anti-slop/no-chained-type-assertions": "error",
        "anti-slop/no-conditional-empty-object-spread": "error",
        "anti-slop/no-known-value-widening": "error",
        "anti-slop/no-object-parameters": "error",
        "anti-slop/no-reflect-apply": "error",
        "anti-slop/no-reflect-get": "error",
        "anti-slop/no-runtime-typeof": "error",
        "anti-slop/no-shape-in-symbol-names": "error",
        "anti-slop/no-unknown-parameters": "error",
        "anti-slop/no-unknown-returns": "error",
        "anti-slop/no-unknown-type-aliases": "error",
        "anti-slop/no-unsafe-dictionary-type": "error",
        "anti-slop/no-widen-then-assert": "error",
        "anti-slop/require-safety-comment-for-type-assertion": "error",
      },
      jsPlugins: [
        { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
        { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      ],
      overrides: [
        {
          files: ["__tests__/**"],
          rules: {
            "anti-slop/no-chained-type-assertions": "off",
            "anti-slop/require-safety-comment-for-type-assertion": "off",
            "anti-slop/no-runtime-typeof": "off",
            "anti-slop/no-unsafe-dictionary-type": "off",
            "anti-slop/no-unknown-parameters": "off",
            "anti-slop/no-unknown-returns": "off",
            // Test idioms that are intentionally unbound / type-loose
            "typescript/unbound-method": "off",
            "typescript/no-base-to-string": "off",
            "typescript/no-misused-spread": "off",
            "typescript/no-this-alias": "off",
            "typescript/no-explicit-any": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "unicorn/no-thenable": "off",
            "jsx-a11y/control-has-associated-label": "off",
            "no-control-regex": "off",
          },
        },
        {
          // SAFETY: coverage-routes uses mock DB chains with Record<string, unknown> for test doubles; widening to concrete types would obscure mock behavior and is test-only.
          files: ["__tests__/unit/api/coverage-routes.test.ts"],
          rules: {
            "anti-slop/no-known-value-widening": "off",
            "anti-slop/no-unsafe-dictionary-type": "off",
          },
        },
      ],
    },
    staged: {
      "*.{ts,tsx,js,jsx,json,css}": ["vp check --fix"],
    },
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
          // Source-map upload — only present when POSTHOG_UPLOAD_SOURCEMAPS=true
          ...(sourcemapPlugin ? [sourcemapPlugin] : []),
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
  };
});
