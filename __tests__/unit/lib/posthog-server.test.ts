import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

describe("captureServerEvent", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const originalHost = env.NEXT_PUBLIC_POSTHOG_HOST;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShutdown.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    } else {
      env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
    }
    if (originalHost === undefined) {
      delete env.NEXT_PUBLIC_POSTHOG_HOST;
    } else {
      env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
    }
  });

  it("no-ops when project token is missing", async () => {
    delete env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const { captureServerEvent } = await import("@/lib/posthog-server");

    await captureServerEvent("user_1", "onboarding_completed", { handle: "ada" });

    expect(MockPostHog).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("no-ops when project token is blank", async () => {
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "   ";
    const { captureServerEvent } = await import("@/lib/posthog-server");

    await captureServerEvent("user_1", "theme_changed");

    expect(MockPostHog).not.toHaveBeenCalled();
  });

  it("captures and shuts down when token is set", async () => {
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
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
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
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
