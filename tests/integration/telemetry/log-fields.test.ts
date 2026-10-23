import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({
  env: { CF_VERSION_METADATA: { id: "version-1", tag: "", timestamp: "2026-10-01T00:00:00Z" } },
}));

const { log, logEvent } = await import("@/lib/utils/log");

function lines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("cloudflare:workers");
});

describe("log deployment fields", () => {
  it("tags every line with the build and the Worker version", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    log("info", "plain line");
    logEvent("resume_upload_failed", { size_bytes: 10 }, "error");

    const deployment = {
      "service.version": __APP_VERSION__,
      "deployment.environment": __DEPLOY_ENV__,
      "cloudflare.script_version.id": "version-1",
    };

    expect(lines(info)).toEqual([expect.objectContaining({ msg: "plain line", ...deployment })]);
    expect(lines(error)).toEqual([
      expect.objectContaining({ event: "resume_upload_failed", size_bytes: 10, ...deployment }),
    ]);
    // An empty tag (no `--tag` on deploy) is left out.
    expect(lines(info)[0]).not.toHaveProperty("faas.version");
  });

  it("keeps the build fields where the binding is absent (client bundles)", async () => {
    vi.resetModules();
    vi.doMock("cloudflare:workers", () => ({ env: {} }));
    const fresh = await import("@/lib/utils/log");
    const info = vi.spyOn(console, "log").mockImplementation(() => {});

    fresh.log("info", "client line");

    expect(lines(info)[0]).toMatchObject({ "service.version": __APP_VERSION__ });
    expect(lines(info)[0]).not.toHaveProperty("cloudflare.script_version.id");
  });
});
