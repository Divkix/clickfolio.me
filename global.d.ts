/// <reference types="vite/client" />

declare global {
  interface Window {
    __clickfolioOwner?: boolean;
    gtag?: (
      command: "event",
      event: "page_view",
      parameters: { page_location: string; page_title: string },
    ) => void;
  }

  // Build-time constants: `define` in vite.config.ts.
  const __APP_VERSION__: string;
  const __DEPLOY_ENV__: "production" | "preview" | "development";
}

export {};
