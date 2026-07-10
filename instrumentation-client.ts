import posthog from "posthog-js";
// Relative import: instrumentation-client runs as a root entry; keep deps local.
import { POSTHOG_PROJECT_TOKEN, POSTHOG_UI_HOST } from "./lib/config/posthog";

// Always init with the project token (public-by-design). Token resolution
// prefers env, then falls back to the production key in lib/config/posthog.
if (POSTHOG_PROJECT_TOKEN) {
  posthog.init(POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: POSTHOG_UI_HOST,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // Match Umami: drop events while the owner is viewing their own profile
    // (OwnerDetector sets window.__clickfolioOwner on /@handle).
    before_send: (event) => {
      if (typeof window !== "undefined" && window.__clickfolioOwner) {
        return null;
      }
      return event;
    },
  });
}
