import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type Plugin } from "vite-plus";

const IGNORE_PATTERNS = [
  "dist/**",
  "lib/cloudflare-env.d.ts",
  "app/routeTree.gen.ts",
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

/**
 * @hyperdx/browser 0.26 flushes its log batch on `unload`, which Chrome deprecates (Lighthouse
 * "deprecations") and which keeps pages out of the back/forward cache. `pagehide` fires in every
 * case `unload` did. The build fails once an SDK upgrade drops the listener, so this goes with it.
 */
function hyperdxPagehideFlush(): Plugin {
  const unload = 'addEventListener("unload"';

  return {
    name: "hyperdx-pagehide-flush",
    transform: {
      filter: { id: /[\\/]@hyperdx[\\/]browser[\\/]build[\\/]index\.js$/ },
      handler(code) {
        if (!code.includes(unload)) {
          this.error("@hyperdx/browser no longer listens for unload: remove hyperdxPagehideFlush");
        }

        return { code: code.replace(unload, 'addEventListener("pagehide"'), map: null };
      },
    },
  };
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
        { name: "clickfolio", specifier: "./tools/oxlint/clickfolio/index.ts" },
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
        "clickfolio/no-stringified-errors": "error",
        "clickfolio/site-data-content-flag": "error",
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
            "clickfolio/no-stringified-errors": "off",
            "clickfolio/site-data-content-flag": "off",
          },
        },
        {
          files: ["scripts/**", "lib/utils/log.ts"],
          rules: { "no-console": "off" },
        },
        {
          // CLIs print to a terminal, where errorFields' redaction is not needed.
          files: ["scripts/**"],
          rules: { "clickfolio/no-stringified-errors": "off" },
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
      // Node has no `cloudflare:workers`; suites that need bindings `vi.mock` it.
      alias: [
        {
          find: "cloudflare:workers",
          replacement: resolve(import.meta.dirname, "tests/helpers/cloudflare-workers.mjs"),
        },
      ],
      exclude: ["node_modules", "dist", ".worktrees/**"],
      pool: "threads",
      projects: [
        {
          test: {
            name: "integration",
            // Lint rule tests sit beside the plugin: tsc would follow a tests/ import into their
            // `.ts`-extension imports, which tsconfig does not allow.
            include: [
              "tests/integration/**/*.test.{ts,tsx}",
              "tools/oxlint/clickfolio/**/*.test.ts",
            ],
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
          "app/routeTree.gen.ts",
        ],
        thresholds: { branches: 62, functions: 64, lines: 61, statements: 61 },
      },
    },
    plugins: isTest
      ? []
      : [
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tanstackStart({
            srcDirectory: "app",
            importProtection: {
              // Client code also lives outside `app/`.
              include: ["app/**", "components/**", "hooks/**", "lib/**"],
              // CODING_STANDARDS.md, "Client bundle".
              client: { specifiers: [/^effect(?:\/|$)/, /^@effect\//] },
            },
          }),
          viteReact(),
          tailwindcss(),
          hyperdxPagehideFlush(),
        ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      // ngrok tunnels for testing the dev server from other devices.
      allowedHosts: [".ngrok-free.app"],
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
