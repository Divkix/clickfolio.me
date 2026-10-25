/// <reference types="vite/client" />

declare global {
  interface Window {
    __clickfolioOwner?: boolean;
  }

  // Build-time constants: `define` in vite.config.ts.
  const __APP_VERSION__: string;
  const __DEPLOY_ENV__: "production" | "preview" | "development";
}

export {};
