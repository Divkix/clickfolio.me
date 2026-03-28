/**
 * Vitest configuration for security tests
 *
 * Security tests verify authorization, IDOR protection,
 * rate limiting, input sanitization, and authentication middleware.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "security",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: [
      "__tests__/security/**/*.test.{ts,tsx}",
      "__tests__/idor-ownership.test.ts",
      "__tests__/sanitization.test.ts",
      "__tests__/disposable-email.test.ts",
      "__tests__/password-strength.test.ts",
      "__tests__/email-verification.test.ts",
    ],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**"],
    // Security tests must be reliable - no retries
    retry: 0,
    // Use forks for security test isolation
    pool: "forks",
    // Security tests need longer timeouts for complex attack scenarios
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage/security",
      include: [
        "lib/auth/**/*.{ts,tsx}",
        "lib/utils/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "lib/schemas/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}", "lib/stubs/**", "**/__tests__/**"],
      // Security tests require high coverage
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
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
