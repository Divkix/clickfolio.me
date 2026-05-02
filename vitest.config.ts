import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"],
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
      // Coverage thresholds - set to current baseline to prevent regressions
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 25,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      // Stub cloudflare:workers for vitest (runs in Node.js, not Workers)
      "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
    },
  },
});
