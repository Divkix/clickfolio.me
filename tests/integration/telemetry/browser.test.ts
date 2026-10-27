import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const hyperdx = vi.hoisted(() => ({
  init: vi.fn(),
  addAction: vi.fn(),
  setGlobalAttributes: vi.fn(),
  recordException: vi.fn(),
}));

vi.mock("@hyperdx/browser", () => ({ default: hyperdx }));

const { errorFields } = await import("@/lib/utils/error-fields");

const { initBrowserTelemetry, reportBoundaryError, setTelemetryUser, trackEvent } =
  await import("@/lib/telemetry/browser");

const ownerWindow: Pick<Window, "__clickfolioOwner"> = {};

beforeAll(() => {
  vi.stubGlobal("document", { readyState: "complete" });
  vi.stubGlobal("location", { origin: "https://clickfolio.me" });
  vi.stubGlobal("window", ownerWindow);
  vi.stubGlobal("requestIdleCallback", (run: () => void) => run());
  initBrowserTelemetry();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  ownerWindow.__clickfolioOwner = undefined;
  hyperdx.addAction.mockClear();
  hyperdx.setGlobalAttributes.mockClear();
  hyperdx.recordException.mockClear();
});

describe("browser telemetry", () => {
  it("loads once, through the same-origin proxy, without session replay", async () => {
    initBrowserTelemetry();

    await vi.waitFor(() => expect(hyperdx.init).toHaveBeenCalledTimes(1));
    expect(hyperdx.init).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://clickfolio.me/otel",
        service: "clickfolio-web",
        tracePropagationTargets: [],
        advancedNetworkCapture: false,
        disableReplay: true,
      }),
    );
  });

  it("sends funnel events, except while an owner views their own portfolio", async () => {
    ownerWindow.__clickfolioOwner = true;
    trackEvent("landing_cta_clicked", { location: "hero" });
    ownerWindow.__clickfolioOwner = false;
    trackEvent("resume_upload_failed", { stage: "upload", http_status: 413 });

    await vi.waitFor(() => expect(hyperdx.addAction).toHaveBeenCalledTimes(1));
    expect(hyperdx.addAction).toHaveBeenCalledWith("resume_upload_failed", {
      stage: "upload",
      http_status: 413,
    });
  });

  it("tags the user id and clears it on sign-out", async () => {
    setTelemetryUser("user_123");
    setTelemetryUser(null);

    await vi.waitFor(() => expect(hyperdx.setGlobalAttributes).toHaveBeenCalledTimes(2));
    expect(hyperdx.setGlobalAttributes.mock.calls).toEqual([
      [{ userId: "user_123" }],
      [{ userId: "" }],
    ]);
  });

  it("reports boundary errors from their scrubbed log fields, even for owners", async () => {
    ownerWindow.__clickfolioOwner = true;
    reportBoundaryError(errorFields(new TypeError("no profile for jane@example.com")));

    await vi.waitFor(() => expect(hyperdx.recordException).toHaveBeenCalledTimes(1));
    const [reported] = hyperdx.recordException.mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect(reported).toMatchObject({ name: "TypeError", message: "no profile for [email]" });
    expect(reported.stack).toMatch(/^TypeError: no profile for \[email\]\n\s+at /);
  });

  it("drops calls when the SDK chunk fails to load", async () => {
    vi.resetModules();
    vi.doMock("@hyperdx/browser", () => {
      throw new Error("blocked by an extension");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fresh = await import("@/lib/telemetry/browser");

    fresh.initBrowserTelemetry();
    fresh.trackEvent("landing_cta_clicked", { location: "footer_cta" });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(hyperdx.addAction).not.toHaveBeenCalled();
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      level: "warn",
      msg: "telemetry SDK failed to load",
      "error.name": "Error",
    });
    warn.mockRestore();
    vi.doUnmock("@hyperdx/browser");
  });
});
