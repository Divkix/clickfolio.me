import { defineConfig } from "vite-plus";
import {
  sharedAlias,
  sharedCoverageProvider,
  sharedExclude,
  sharedSetupFiles,
} from "./vitest.base.config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: sharedSetupFiles,
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: sharedExclude,
    retry: 2,
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
        "worker/**/*",
        "lib/stubs/**",
        "lib/db/migrations/**",
      ],
    },
  },
  resolve: {
    alias: {
      ...sharedAlias,
    },
  },
});
