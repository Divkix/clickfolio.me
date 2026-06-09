/**
 * Vitest configuration for unit tests
 *
 * Unit tests focus on pure functions, utilities, and isolated logic.
 * Fast execution, no external service dependencies.
 */

import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: [
      "__tests__/unit/**/*.test.{ts,tsx}",
      // Root-level tests that belong to the unit suite
      "__tests__/privacy.test.ts",
      "__tests__/profile-schema.test.ts",
      "__tests__/resume-schema.test.ts",
      "__tests__/sitemap.test.ts",
      "__tests__/sync-disposable-domains.test.ts",
      "__tests__/theme-id-consistency.test.ts",
    ],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"],
    // Unit tests should be fast - no retries needed
    retry: 0,
    // Isolate each test file
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage/unit",
      include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "lib/stubs/**",
        "lib/db/migrations/**",
        "**/__tests__/**",
        "worker/**/*",
        "app/blog/**", // Static content pages — no testable logic
        "app/for/**", // Static profession landing pages — no testable logic
      ],
      thresholds: {
        statements: 20,
        branches: 15,
        functions: 20,
        lines: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
    },
  },
});
