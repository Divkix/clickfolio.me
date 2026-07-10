import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// Skip init when the project token is unset (local/CI without analytics).
// Avoids noisy client errors and failed /ingest requests.
if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
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
