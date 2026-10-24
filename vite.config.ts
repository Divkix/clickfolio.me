import { relative, resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";
import { visualizer } from "rollup-plugin-visualizer";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite-plus";

/**
 * Vite plugin that stubs server-only modules for client environments.
 * - `cloudflare:workers` — Workers-only module imported by server code, absent in the browser
 *
 * `node:async_hooks` needs no entry: vinext's own `vinext:async-hooks-stub` serves the client one.
 */
function clientModuleStubs(): Plugin {
  const stubs = {
    "cloudflare:workers": resolve("lib/stubs/cloudflare-workers-client-stub.mjs"),
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

// Files inside the effect package or an @effect/* package (flat or pnpm layout).
const EFFECT_MODULE = /[\\/]node_modules[\\/](?:effect|@effect[\\/][^\\/]+)[\\/]/;

/**
 * Fails the client build when the browser module graph reaches Effect
 * (AGENTS.md, "No Effect in client-reachable code"). It reads the graph before
 * tree-shaking, so a client value import from a module that also imports
 * effect fails even when the Effect code would be shaken out.
 */
function clientEffectGuard(): Plugin {
  return {
    name: "client-effect-guard",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    buildEnd(error) {
      if (error) return;

      const root = this.environment.config.root;

      // One importer path from the offending module up to an entry (stops at a cycle).
      const importerChain = (id: string): string => {
        const chain: string[] = [];

        for (let current: string | undefined = id; current && !chain.includes(current);) {
          chain.push(current);
          const info = this.getModuleInfo(current);
          current = info?.importers[0] ?? info?.dynamicImporters[0];
        }

        return chain.map((m) => relative(root, m.replaceAll("\0", ""))).join("\n    imported by ");
      };

      const offenders: string[] = [];

      for (const id of this.getModuleIds()) {
        if (EFFECT_MODULE.test(id)) continue;

        const info = this.getModuleInfo(id);
        const deps = info ? [...info.importedIds, ...info.dynamicallyImportedIds] : [];

        if (deps.some((dep) => EFFECT_MODULE.test(dep))) offenders.push(importerChain(id));
      }

      if (offenders.length > 0) {
        this.error(
          `effect must not reach the client bundle (AGENTS.md, "No Effect in client-reachable code"):\n  ${offenders.join("\n  ")}`,
        );
      }
    },
  };
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

// Workers Builds sets these at build time:
// https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
function deployEnv(): "production" | "preview" | "development" {
  if (!process.env.WORKERS_CI) return "development";

  return process.env.WORKERS_CI_BRANCH === "main" ? "production" : "preview";
}

export default defineConfig(() => {
  const isTest = Boolean(process.env.VITEST);

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 12) ?? "dev"),
      __DEPLOY_ENV__: JSON.stringify(deployEnv()),
    },
    fmt: {
      ignorePatterns: IGNORE_PATTERNS,
    },
    lint: {
      plugins: ["react", "typescript", "jsx-a11y", "oxc"],
      options: { typeAware: true, typeCheck: true },
      jsPlugins: [
        { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
        { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
        { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
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
        "anti-slop-effect/no-manual-effect-error-tag": "error",
        "anti-slop-effect/no-manual-tag-comparison": "error",
        "anti-slop-effect/no-manual-tagged-construction": "error",
        "anti-slop-effect/no-service-constructor-imports": "error",
        "anti-slop-effect/prefer-effect-match": "error",
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
      environment: "node",
      globals: true,
      alias: {
        "@": resolve(import.meta.dirname, "./"),
        "cloudflare:workers": resolve(
          import.meta.dirname,
          "lib/stubs/cloudflare-workers-client-stub.mjs",
        ),
      },
      exclude: ["node_modules", ".next", "dist", ".worktrees/**"],
      pool: "threads",
      projects: [
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
        include: [
          "lib/**/*.{ts,tsx}",
          "app/**/*.{ts,tsx}",
          "components/**/*.{ts,tsx}",
          "worker/**/*.{ts,tsx}",
        ],
        exclude: [
          "**/*.d.ts",
          "**/*.test.{ts,tsx}",
          "**/node_modules/**",
          "tests/**",
          "lib/stubs/**",
        ],
        thresholds: { branches: 62, functions: 64, lines: 61, statements: 61 },
      },
    },
    plugins: isTest
      ? []
      : [
          vinext({
            // Edge-cached ISR on Workers Cache; purges go through a queue
            // (lib/cache/queued-cdn-adapter.ts, worker/index.ts `queue`).
            cache: {
              cdn: {
                ...workersCacheCdnAdapter(),
                adapter: resolve("lib/cache/queued-cdn-adapter.ts"),
              },
            },
          }),
          cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          }),
          clientModuleStubs(),
          clientEffectGuard(),
        ],
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    build: isTest
      ? undefined
      : {
          rolldownOptions: {
            plugins: [
              ...(process.env.ANALYZE === "true"
                ? [visualizer({ open: true, gzipSize: true, filename: "dist/stats.html" })]
                : []),
            ],
          },
        },
  };
});
