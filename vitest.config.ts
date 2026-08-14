import { defineConfig } from "vite-plus";
import {
  sharedAlias,
  sharedCoverageProvider,
  sharedExclude,
  sharedSetupFiles,
  sharedServerInline,
  sharedZxcvbnAlias,
} from "./vitest.base.config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: sharedSetupFiles,
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: sharedExclude,
    // zxcvbn-ts v4 language packs ship a broken CJS interop for their decompressor
    // (see resolve.alias below); inline them so Vite transforms the ESM build.
    server: { deps: { inline: sharedServerInline } },
    // Retry flaky tests twice before failing
    retry: 2,
    // Parallel test execution - uses threads by default in vitest v4
    pool: "threads",
    coverage: {
      provider: sharedCoverageProvider,
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
      ...sharedAlias,
      ...sharedZxcvbnAlias,
    },
  },
});
