import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
  mockCaptureImmediate,
  mockCaptureExceptionImmediate,
  mockShutdown,
  MockPostHog,
  mockWaitUntil,
  mockLog,
} = vi.hoisted(() => {
  const mockCaptureImmediate = vi.fn();
  const mockCaptureExceptionImmediate = vi.fn();
  const mockShutdown = vi.fn();

  const MockPostHog = vi.fn(function MockPostHog() {
    return {
      captureImmediate: mockCaptureImmediate,
      captureExceptionImmediate: mockCaptureExceptionImmediate,
      shutdown: mockShutdown,
    };
  });

  return {
    mockCaptureImmediate,
    mockCaptureExceptionImmediate,
    mockShutdown,
    MockPostHog,
    mockWaitUntil: vi.fn<(promise: Promise<void>) => void>(),
    mockLog: vi.fn(),
  };
});

vi.mock("posthog-node", () => ({
  PostHog: MockPostHog,
}));

vi.mock("cloudflare:workers", () => ({
  waitUntil: mockWaitUntil,
}));

vi.mock("@/lib/utils/log", () => ({
  log: mockLog,
}));

vi.mock("@/lib/analytics/config", () => ({
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_API_HOST: "https://s.clickfolio.me",
  POSTHOG_UI_HOST: "https://us.posthog.com",
}));

function lastWaitUntilPromise(): Promise<void> {
  expect(mockWaitUntil).toHaveBeenCalled();
  const registrations = mockWaitUntil.mock.calls;

  return registrations[registrations.length - 1][0];
}

describe("captureServerEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureImmediate.mockResolvedValue(undefined);
    mockCaptureExceptionImmediate.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
  });

  it("creates a fresh client with immediate-flush, no-retry options", async () => {
    const { captureServerEvent } = await import("@/lib/analytics/server");

    captureServerEvent("user_1", "resume_claimed", { resume_id: "r1" });

    expect(MockPostHog).toHaveBeenCalledWith("phc_test", {
      host: "https://s.clickfolio.me",
      flushAt: 1,
      flushInterval: 0,
      fetchRetryCount: 0,
      requestTimeout: 1000,
    });
  });

  it("captures immediately and registers ONE waitUntil promise ending in shutdown(1000)", async () => {
    const { captureServerEvent } = await import("@/lib/analytics/server");

    captureServerEvent("user_1", "resume_claimed", { resume_id: "r1" });

    expect(mockCaptureImmediate).toHaveBeenCalledWith({
      distinctId: "user_1",
      event: "resume_claimed",
      properties: { resume_id: "r1" },
    });
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);

    await lastWaitUntilPromise();

    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledWith(1000);
  });

  it("builds a fresh client per send instead of reusing an isolate singleton", async () => {
    const { captureServerEvent } = await import("@/lib/analytics/server");

    captureServerEvent("user_1", "theme_changed", { theme_id: "bento" });
    captureServerEvent("user_2", "handle_changed", { new_handle: "avery" });

    expect(MockPostHog).toHaveBeenCalledTimes(2);
    expect(mockWaitUntil).toHaveBeenCalledTimes(2);
    await Promise.all([mockWaitUntil.mock.calls[0][0], mockWaitUntil.mock.calls[1][0]]);
    expect(mockShutdown).toHaveBeenCalledTimes(2);
  });

  it("is fail-open: capture failures are logged, never thrown, and still shut down", async () => {
    mockCaptureImmediate.mockRejectedValueOnce(new Error("network down"));
    const { captureServerEvent } = await import("@/lib/analytics/server");

    captureServerEvent("user_1", "account_deleted", { had_r2_warnings: false });
    await expect(lastWaitUntilPromise()).resolves.toBeUndefined();

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "analytics capture failed",
      expect.objectContaining({ error: "network down" }),
    );
    expect(mockShutdown).toHaveBeenCalledWith(1000);
  });

  it("is fail-open when the terminal shutdown itself rejects", async () => {
    mockShutdown.mockRejectedValueOnce(new Error("shutdown timed out"));
    const { captureServerEvent } = await import("@/lib/analytics/server");

    captureServerEvent("user_1", "onboarding_completed", {
      handle: "avery",
      theme_id: "bento",
      show_in_directory: true,
    });
    await expect(lastWaitUntilPromise()).resolves.toBeUndefined();

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "analytics shutdown failed",
      expect.objectContaining({ error: "shutdown timed out" }),
    );
  });
});

describe("captureServerException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureImmediate.mockResolvedValue(undefined);
    mockCaptureExceptionImmediate.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
  });

  it("passes metadata in the third argument, never the distinct-id slot", async () => {
    const { captureServerException } = await import("@/lib/analytics/server");
    const error = new Error("boom");

    await captureServerException(error, { request_path: "/api/x" });

    expect(mockCaptureExceptionImmediate).toHaveBeenCalledTimes(1);
    const [capturedError, distinctId, properties] = mockCaptureExceptionImmediate.mock.calls[0];
    expect(capturedError).toBe(error);
    expect(distinctId).toBeUndefined();
    expect(properties).toEqual({ request_path: "/api/x" });
    expect(mockShutdown).toHaveBeenCalledWith(1000);
  });

  it("resolves even when the exception upload fails (logged, not thrown)", async () => {
    mockCaptureExceptionImmediate.mockRejectedValueOnce(new Error("posthog down"));
    const { captureServerException } = await import("@/lib/analytics/server");

    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "analytics exception capture failed",
      expect.objectContaining({ error: "posthog down" }),
    );
    expect(mockShutdown).toHaveBeenCalledWith(1000);
  });

  it("swallows shutdown failures after successful exception capture", async () => {
    mockShutdown.mockRejectedValueOnce(new Error("shutdown timed out"));
    const { captureServerException } = await import("@/lib/analytics/server");

    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "analytics shutdown failed",
      expect.objectContaining({ error: "shutdown timed out" }),
    );
  });
});

describe("captureServerException distinct id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureExceptionImmediate.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
  });

  it("forwards the distinct id in posthog-node's distinct-id slot", async () => {
    const { captureServerException } = await import("@/lib/analytics/server");

    await captureServerException(new Error("boom"), { request_path: "/x" }, "anon-123");

    const [, distinctId, properties] = mockCaptureExceptionImmediate.mock.calls[0];
    expect(distinctId).toBe("anon-123");
    expect(properties).toEqual({ request_path: "/x" });
  });
});

describe("distinctIdFromCookieHeader", () => {
  type PostHogCookieValue = { distinct_id?: string; $sesid?: number[] };

  const phCookie = (value: PostHogCookieValue) =>
    `ph_phc_test_posthog=${encodeURIComponent(JSON.stringify(value))}`;

  it("reads distinct_id from this project's posthog-js cookie", async () => {
    const { distinctIdFromCookieHeader } = await import("@/lib/analytics/server");

    expect(
      distinctIdFromCookieHeader(`__session=abc; ${phCookie({ distinct_id: "anon-123" })}; x=1`),
    ).toBe("anon-123");
  });

  it("accepts the array form of the cookie header", async () => {
    const { distinctIdFromCookieHeader } = await import("@/lib/analytics/server");

    expect(distinctIdFromCookieHeader(["a=1", phCookie({ distinct_id: "user_9" })])).toBe("user_9");
  });

  it("ignores another project's PostHog cookie", async () => {
    const { distinctIdFromCookieHeader } = await import("@/lib/analytics/server");

    expect(
      distinctIdFromCookieHeader(
        `ph_phc_other_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "x" }))}`,
      ),
    ).toBeUndefined();
  });

  it("returns undefined for missing, malformed, or id-less cookies", async () => {
    const { distinctIdFromCookieHeader } = await import("@/lib/analytics/server");

    expect(distinctIdFromCookieHeader(undefined)).toBeUndefined();
    expect(distinctIdFromCookieHeader("ph_phc_test_posthog=%7Bnot-json")).toBeUndefined();
    expect(distinctIdFromCookieHeader(phCookie({ $sesid: [1] }))).toBeUndefined();
  });
});

describe("captureServerEvent without token", () => {
  it("no-ops when project token is empty", async () => {
    vi.resetModules();
    vi.doMock("@/lib/analytics/config", () => ({
      POSTHOG_PROJECT_TOKEN: "",
      POSTHOG_API_HOST: "https://s.clickfolio.me",
      POSTHOG_UI_HOST: "https://us.posthog.com",
    }));
    vi.doMock("posthog-node", () => ({ PostHog: MockPostHog }));
    vi.doMock("cloudflare:workers", () => ({ waitUntil: mockWaitUntil }));
    vi.doMock("@/lib/utils/log", () => ({ log: mockLog }));

    const { captureServerEvent } = await import("@/lib/analytics/server");
    MockPostHog.mockClear();

    captureServerEvent("user_1", "theme_changed", { theme_id: "bento" });

    expect(MockPostHog).not.toHaveBeenCalled();
    expect(mockWaitUntil).not.toHaveBeenCalled();
  });
});
