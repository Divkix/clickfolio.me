import { defineConfig } from "vite-plus";
import {
  sharedAlias,
  sharedCoverageProvider,
  sharedExclude,
  sharedSetupFiles,
} from "./vitest.base.config";
export default defineConfig({
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: sharedSetupFiles,
    include: [
      "__tests__/unit/**/*.test.{ts,tsx}",
      "__tests__/privacy.test.ts",
      "__tests__/profile-schema.test.ts",
      "__tests__/resume-schema.test.ts",
      "__tests__/sitemap.test.ts",
      "__tests__/theme-id-consistency.test.ts",
    ],
    exclude: sharedExclude,
    retry: 0,
    isolate: true,
    coverage: {
      provider: sharedCoverageProvider,
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
        "app/blog/**",
        "app/for/**",
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
      ...sharedAlias,
    },
  },
});
