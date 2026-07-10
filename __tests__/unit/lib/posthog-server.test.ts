import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockCapture, mockShutdown, MockPostHog } = vi.hoisted(() => {
  const mockCapture = vi.fn();
  const mockShutdown = vi.fn().mockResolvedValue(undefined);
  const MockPostHog = vi.fn(function MockPostHog() {
    return { capture: mockCapture, shutdown: mockShutdown };
  });
  return { mockCapture, mockShutdown, MockPostHog };
});

vi.mock("posthog-node", () => ({
  PostHog: MockPostHog,
}));

vi.mock("@/lib/utils/log", () => ({
  log: vi.fn(),
}));

// Isolate token resolution so tests don't depend on the production default.
vi.mock("@/lib/config/posthog", () => ({
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://us.i.posthog.com",
  POSTHOG_UI_HOST: "https://us.posthog.com",
}));

describe("captureServerEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShutdown.mockResolvedValue(undefined);
  });

  it("captures and shuts down with the configured token", async () => {
    const { captureServerEvent } = await import("@/lib/posthog-server");

    await captureServerEvent("user_1", "resume_claimed", { resume_id: "r1" });

    expect(MockPostHog).toHaveBeenCalledWith("phc_test", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user_1",
      event: "resume_claimed",
      properties: { resume_id: "r1" },
    });
    expect(mockShutdown).toHaveBeenCalled();
  });

  it("swallows capture/shutdown errors so callers never throw", async () => {
    mockShutdown.mockRejectedValueOnce(new Error("network down"));
    const { log } = await import("@/lib/utils/log");
    const { captureServerEvent } = await import("@/lib/posthog-server");

    await expect(
      captureServerEvent("user_1", "account_deleted", { had_r2_warnings: false }),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      "warn",
      "posthog capture failed",
      expect.objectContaining({
        event: "account_deleted",
        distinctId: "user_1",
        error: "network down",
      }),
    );
  });
});

describe("captureServerEvent without token", () => {
  it("no-ops when project token is empty", async () => {
    vi.resetModules();
    vi.doMock("@/lib/config/posthog", () => ({
      POSTHOG_PROJECT_TOKEN: "",
      POSTHOG_HOST: "https://us.i.posthog.com",
      POSTHOG_UI_HOST: "https://us.posthog.com",
    }));
    // Re-apply peer mocks after resetModules
    vi.doMock("posthog-node", () => ({
      PostHog: MockPostHog,
    }));
    vi.doMock("@/lib/utils/log", () => ({
      log: vi.fn(),
    }));

    const { captureServerEvent } = await import("@/lib/posthog-server");
    MockPostHog.mockClear();
    mockCapture.mockClear();

    await captureServerEvent("user_1", "theme_changed");

    expect(MockPostHog).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
