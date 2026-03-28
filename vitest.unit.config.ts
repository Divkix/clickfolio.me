/**
 * Vitest configuration for unit tests
 *
 * Unit tests focus on pure functions, utilities, and isolated logic.
 * Fast execution, no external service dependencies.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/unit/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**"],
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
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "cloudflare:workers": new URL("lib/stubs/cloudflare-workers-client-stub.mjs", import.meta.url)
        .pathname,
    },
  },
});
