/**
 * Browser telemetry (`@hyperdx/browser`): traces, console logs, errors and
 * masked session replay, sent through the same-origin `/otel` ingest proxy
 * (`lib/worker/otel-proxy.ts`), which holds the ingestion key. The SDK (~190 KB
 * gzip) loads once the page is idle; calls made earlier wait for it and are
 * dropped if it never loads.
 */
// Relative imports: instrumentation-client.ts imports this as a root entry.
import type HyperDXBrowser from "@hyperdx/browser";
// Type only: error-fields pulls in zod/mini, which must stay out of the entry chunk.
import type { ErrorFields } from "../utils/error-fields";

type HyperDX = typeof HyperDXBrowser;

export type LandingCtaLocation = "hero" | "hero_claim" | "footer_cta";

export type CheckedHandleStatus = "available" | "taken" | "unknown";

export type UploadStage = "read" | "upload" | "claim" | "save";

// Opaque values only: never handles, file names, emails or message text.
type ProductEvents = {
  landing_cta_clicked: { location: LandingCtaLocation };
  landing_handle_checked: { status: CheckedHandleStatus };
  resume_uploaded: { file_size_bytes: number };
  resume_upload_failed: { stage: UploadStage; http_status: number };
};

// Clerk's Frontend API: its own telemetry, and dev instances put tokens in URLs.
const IGNORED_URLS = [/^https:\/\/clerk\.clickfolio\.me\//, /\.clerk\.accounts\.dev\//];

let sdk: Promise<HyperDX | null> | undefined;

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idle = () =>
      "requestIdleCallback" in globalThis
        ? requestIdleCallback(() => resolve(), { timeout: 5000 })
        : setTimeout(resolve, 1000);

    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  });
}

export function initBrowserTelemetry(): void {
  if (sdk) return;

  sdk = whenIdle()
    .then(() => import("@hyperdx/browser"))
    .then(({ default: hyperdx }) => {
      hyperdx.init({
        url: `${location.origin}/otel`,
        // Required by the SDK; the proxy replaces it with the real key.
        apiKey: "proxied",
        service: "clickfolio-web",
        // Same-origin requests always get traceparent; no third party does.
        tracePropagationTargets: [],
        ignoreUrls: IGNORED_URLS,
        consoleCapture: true,
        // Request and response bodies carry resume data and tokens.
        advancedNetworkCapture: false,
        disableIntercom: true,
        // Personal data renders on almost every page, so replay masks everything.
        maskAllInputs: true,
        maskAllText: true,
        otelResourceAttributes: {
          "deployment.environment": __DEPLOY_ENV__,
          "service.version": __APP_VERSION__,
        },
      });

      return hyperdx;
    })
    // Blocked or failed chunk: telemetry stays best-effort, but the reason is logged. The
    // logger and scrubber load on this path only, so they stay out of the entry chunk.
    .catch(async (error) => {
      const [{ errorFields }, { log }] = await Promise.all([
        import("../utils/error-fields"),
        import("../utils/log"),
      ]);

      log("warn", "telemetry SDK failed to load", errorFields(error));

      return null;
    });
}

function withSdk(use: (hyperdx: HyperDX) => void): void {
  void sdk?.then((hyperdx) => {
    if (hyperdx) use(hyperdx);
  });
}

/** Funnel event. Skipped while an owner views their own portfolio, like Umami page views. */
export function trackEvent<E extends keyof ProductEvents>(
  event: E,
  attributes: ProductEvents[E],
): void {
  if (globalThis.window?.__clickfolioOwner) return;

  withSdk((hyperdx) => hyperdx.addAction(event, attributes));
}

/** Opaque app user id (never email or name); null when signed out. */
export function setTelemetryUser(userId: string | null): void {
  withSdk((hyperdx) => hyperdx.setGlobalAttributes({ userId: userId ?? "" }));
}

/** An error caught by an error boundary, as the boundary logged it (already scrubbed). */
export function reportBoundaryError(fields: ErrorFields): void {
  // A real Error: the SDK replaces plain objects with a placeholder exception.
  const error = new Error(fields["error.message"]);
  error.name = fields["error.name"];
  error.stack = fields.stack;

  withSdk((hyperdx) => hyperdx.recordException(error));
}
