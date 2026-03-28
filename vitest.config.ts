import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    // Retry flaky tests once before failing
    retry: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.d.ts", "**/*.test.*", "lib/stubs/**"],
      // Coverage thresholds — start conservative, tighten over time
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      // Stub cloudflare:workers for vitest (runs in Node.js, not Workers)
      "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
    },
  },
});
