import { defineConfig } from "vite-plus";
import {
  sharedAlias,
  sharedCoverageProvider,
  sharedExclude,
  sharedSetupFiles,
} from "./vitest.base.config";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
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
    retry: 2,
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
