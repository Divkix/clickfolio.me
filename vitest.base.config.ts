import { resolve } from "node:path";

export const sharedExclude = ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"];
export const sharedSetupFiles = ["./__tests__/setup.ts"];
export const sharedAlias = {
  "@": resolve(__dirname, "./"),
  "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
};
export const sharedCoverageProvider = "v8" as const;
