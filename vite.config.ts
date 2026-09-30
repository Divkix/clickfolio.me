import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import posthogRollupPlugin from "@posthog/rollup-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import vinext from "vinext";
import { defineConfig, loadEnv, type Plugin } from "vite-plus";
import { failOpenSourcemapUpload } from "./lib/analytics/sourcemap-upload";
import { log } from "./lib/utils/log";

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
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";

          if (id.includes("node_modules/react-hook-form")) return "vendor-forms";

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
 * re-enable it. Upload is observability, never a deploy blocker: PostHog API
 * failures during the build are caught by failOpenSourcemapUpload.
 */
function sourceMapUploadPlugin(mode: string): Plugin | null {
  if (process.env.POSTHOG_UPLOAD_SOURCEMAPS !== "true") return null;

  const env = loadEnv(mode, process.cwd(), "");

  if (!env.POSTHOG_API_KEY || !env.POSTHOG_PROJECT_ID) {
    log(
      "warn",
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
  // Rolldown compatibility layer; only the package contexts differ.
  return failOpenSourcemapUpload(plugin as Plugin);
}

const IGNORE_PATTERNS = [
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
  const isTest = Boolean(process.env.VITEST);
  const sourcemapPlugin = isTest ? null : sourceMapUploadPlugin(mode);

  return {
    fmt: {
      ignorePatterns: IGNORE_PATTERNS,
    },
    lint: {
      plugins: ["react", "typescript", "jsx-a11y", "oxc"],
      options: { typeAware: true, typeCheck: true },
      jsPlugins: [
        { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
        { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      ],
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        "no-console": "error",
        "oxc/no-accumulating-spread": "error",
        "typescript/no-explicit-any": "warn",
        "typescript/no-unused-vars": "error",
        "anti-slop/no-array-filter-map": "error",
        "anti-slop/no-reduce-accumulator-copy": "error",
        "anti-slop/no-chained-type-assertions": "error",
        "anti-slop/no-conditional-empty-object-spread": "error",
        "anti-slop/no-known-value-widening": "error",
        "anti-slop/no-module-mocking": "error",
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
        "anti-slop/require-readable-spacing": "error",
        "anti-slop/require-safety-comment-for-type-assertion": "error",
      },
      overrides: [
        {
          files: ["tests/**"],
          rules: {
            "typescript/unbound-method": "off",
            "typescript/no-base-to-string": "off",
            "typescript/no-misused-spread": "off",
            "typescript/no-this-alias": "off",
            "typescript/no-explicit-any": "off",
            "unicorn/no-thenable": "off",
            "jsx-a11y/control-has-associated-label": "off",
            "no-control-regex": "off",
            "no-console": "off",
          },
        },
        {
          files: ["scripts/**", "lib/utils/log.ts"],
          rules: { "no-console": "off" },
        },
      ],
      ignorePatterns: IGNORE_PATTERNS,
    },
    staged: {
      "*.{js,jsx,ts,tsx,json,css}": ["vp check --fix"],
      "package.json": ["bash -c 'pnpm install'", "git add pnpm-lock.yaml"],
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      alias: {
        "@": resolve(import.meta.dirname, "./"),
        "cloudflare:workers": resolve(
          import.meta.dirname,
          "lib/stubs/cloudflare-workers-client-stub.mjs",
        ),
        "cloudflare:workflows": resolve(
          import.meta.dirname,
          "lib/stubs/cloudflare-workflows-test-stub.mjs",
        ),
      },
      exclude: ["node_modules", ".next", "dist", "tests/e2e/**", ".worktrees/**"],
      pool: "threads",
      projects: [
        { test: { name: "unit", include: ["tests/unit/**/*.test.{ts,tsx}"] } },
        {
          test: {
            name: "integration",
            include: ["tests/integration/**/*.test.{ts,tsx}"],
            testTimeout: 10000,
          },
        },
        {
          test: {
            name: "security",
            include: ["tests/security/**/*.test.{ts,tsx}"],
            pool: "forks",
            testTimeout: 15000,
          },
        },
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "json-summary"],
        reportsDirectory: "./coverage",
        include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
        exclude: [
          "**/*.d.ts",
          "**/*.test.{ts,tsx}",
          "**/node_modules/**",
          "tests/**",
          "worker/**/*",
          "lib/stubs/**",
          "lib/db/migrations/**",
        ],
        thresholds: { branches: 70, functions: 70, lines: 75, statements: 75 },
      },
    },
    plugins: isTest
      ? []
      : [
          ensureClientDir(),
          vinext(),
          cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          }),
          clientModuleStubs(),
          clientVendorSplit(),
          // Top-level Vite plugin, per PostHog's Vite source-map docs; inside
          // build.rollupOptions.plugins its Vite `config` hook is ignored.
          ...(sourcemapPlugin ? [sourcemapPlugin] : []),
        ],
    resolve: isTest
      ? undefined
      : {
          alias: {
            "next/dist/compiled/@vercel/og/index.edge.js": resolve("lib/stubs/og-stub.js"),
            "zod/v3": resolve("lib/stubs/zod-v3-stub.mjs"),
          },
        },
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    build: isTest
      ? undefined
      : {
          rollupOptions: {
            plugins: [
              ...(process.env.ANALYZE === "true"
                ? [visualizer({ open: true, gzipSize: true, filename: "dist/stats.html" })]
                : []),
            ],
            onwarn(warning, warn) {
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
