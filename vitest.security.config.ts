/**
 * Vitest configuration for security tests
 *
 * Security tests verify authorization, IDOR protection,
 * rate limiting, input sanitization, and authentication middleware.
 */

import { defineConfig } from "vite-plus";
import { sharedAlias, sharedCoverageProvider, sharedSetupFiles } from "./vitest.base.config";

export default defineConfig({
  test: {
    name: "security",
    environment: "jsdom",
    globals: true,
    setupFiles: sharedSetupFiles,
    include: [
      "__tests__/security/**/*.test.{ts,tsx}",
      "__tests__/idor-ownership.test.ts",
      "__tests__/sanitization.test.ts",
      "__tests__/disposable-email.test.ts",
      "__tests__/claim-security-cookie.test.ts",
    ],
    // Security tests must be reliable - no retries
    retry: 0,
    // Use forks for security test isolation
    pool: "forks",
    // Security tests need longer timeouts for complex attack scenarios
    testTimeout: 15000,
    coverage: {
      provider: sharedCoverageProvider,
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage/security",
      include: [
        "lib/auth/**/*.{ts,tsx}",
        "lib/utils/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "lib/schemas/**/*.{ts,tsx}",
        "lib/rate-limit/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}", "lib/stubs/**", "**/__tests__/**"],
      // Security tests require high coverage
      thresholds: {
        statements: 20,
        branches: 15,
        functions: 15,
        lines: 20,
      },
    },
  },
  resolve: {
    alias: {
      ...sharedAlias,
    },
  },
});
