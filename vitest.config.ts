import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"],
    // zxcvbn-ts v4 language packs ship a broken CJS interop for their decompressor
    // (see resolve.alias below); inline them so Vite transforms the ESM build.
    server: { deps: { inline: [/@zxcvbn-ts\//] } },
    // Retry flaky tests twice before failing
    retry: 2,
    // Parallel test execution - uses threads by default in vitest v4
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "**/__tests__/**",
        "worker/**/*", // Worker entry point (hard to test)
        "lib/stubs/**",
        "lib/db/migrations/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      // Stub cloudflare:workers for vitest (runs in Node.js, not Workers)
      "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
      // zxcvbn-ts v4's `main` points to a CJS build whose decompressor interop is
      // broken under Node require; resolve the working ESM entry points instead.
      "@zxcvbn-ts/language-common": resolve(
        __dirname,
        "node_modules/@zxcvbn-ts/language-common/dist/index.mjs",
      ),
      "@zxcvbn-ts/language-en": resolve(
        __dirname,
        "node_modules/@zxcvbn-ts/language-en/dist/index.mjs",
      ),
    },
  },
});
