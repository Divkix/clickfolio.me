/**
 * Vitest configuration for security tests
 *
 * Security tests verify authorization, IDOR protection,
 * rate limiting, input sanitization, and authentication middleware.
 */

import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

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
      "__tests__/claim-security-cookie.test.ts",
    ],
    exclude: ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"],
    // zxcvbn-ts v4 language packs ship a broken CJS interop for their decompressor
    // (see resolve.alias below); inline them so Vite transforms the ESM build.
    server: { deps: { inline: [/@zxcvbn-ts\//] } },
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
      "@": resolve(__dirname, "./"),
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
