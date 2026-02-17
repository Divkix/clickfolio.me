import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".open-next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.d.ts", "**/*.test.*", "lib/stubs/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
