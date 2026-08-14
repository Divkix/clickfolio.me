import { resolve } from "node:path";

export const sharedExclude = ["node_modules", ".next", "dist", "__tests__/e2e/**", ".worktrees/**"];
export const sharedSetupFiles = ["./__tests__/setup.ts"];
export const sharedAlias = {
  "@": resolve(__dirname, "./"),
  "cloudflare:workers": resolve(__dirname, "lib/stubs/cloudflare-workers-client-stub.mjs"),
};
export const sharedZxcvbnAlias = {
  "@zxcvbn-ts/language-common": resolve(
    __dirname,
    "node_modules/@zxcvbn-ts/language-common/dist/index.mjs",
  ),
  "@zxcvbn-ts/language-en": resolve(
    __dirname,
    "node_modules/@zxcvbn-ts/language-en/dist/index.mjs",
  ),
};
export const sharedServerInline = [/@zxcvbn-ts\//];
export const sharedCoverageProvider = "v8" as const;
