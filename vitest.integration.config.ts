/**
 * Vitest configuration for integration tests
 *
 * Integration tests verify API routes, service interactions,
 * database operations, and queue processing.
 * May use mocked external services.
 */

import { defineConfig } from "vite-plus";
import {
  sharedAlias,
  sharedCoverageProvider,
  sharedExclude,
  sharedSetupFiles,
} from "./vitest.base.config";

export default defineConfig({
  test: {
    name: "integration",
    environment: "jsdom",
    globals: true,
    setupFiles: sharedSetupFiles,
    include: [
      "__tests__/integration/**/*.test.{ts,tsx}",
      "__tests__/claim-flow.test.ts",
      "__tests__/share.test.ts",
    ],
    exclude: sharedExclude,
    // Integration tests may have timing issues - allow retries
    retry: 2,
    // Longer timeout for integration tests
    testTimeout: 10000,
    coverage: {
      provider: sharedCoverageProvider,
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage/integration",
      include: ["lib/**/*.{ts,tsx}", "app/api/**/*.{ts,tsx}", "worker/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "lib/stubs/**",
        "lib/db/migrations/**",
        "**/__tests__/**",
      ],
      thresholds: {
        statements: 34,
        branches: 24,
        functions: 27,
        lines: 34,
      },
    },
  },
  resolve: {
    alias: {
      ...sharedAlias,
    },
  },
});
