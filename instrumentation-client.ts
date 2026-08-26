// Exception autocapture extension must be imported before init: it preloads
// window.__PosthogExtensions__.errorWrappingFunctions so capture_exceptions
// uses our bundled handlers instead of fetching an external script at runtime
// (we ship the no-external posthog-js build).
import "posthog-js/dist/exception-autocapture";
import posthog from "posthog-js/dist/module.no-external";
// Relative import: instrumentation-client runs as a root entry; keep deps local.
import { POSTHOG_API_HOST, POSTHOG_PROJECT_TOKEN, POSTHOG_UI_HOST } from "./lib/analytics/config";

declare global {
  interface Window {
    __clickfolioOwner?: boolean;
  }
}

// Always init with the project token (public-by-design, see lib/analytics/config).
if (POSTHOG_PROJECT_TOKEN) {
  posthog.init(POSTHOG_PROJECT_TOKEN, {
    api_host: POSTHOG_API_HOST,
    ui_host: POSTHOG_UI_HOST,
    defaults: "2026-05-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // Match Umami: drop events while the owner is viewing their own profile
    // (OwnerDetector sets window.__clickfolioOwner on /@handle). Exceptions
    // are NEVER suppressed — $exception always reaches Error Tracking.
    before_send: (event) => {
      if (
        event?.event !== "$exception" &&
        globalThis.window !== undefined &&
        globalThis.window.__clickfolioOwner
      ) {
        return null;
      }
      return event;
    },
  });
}
