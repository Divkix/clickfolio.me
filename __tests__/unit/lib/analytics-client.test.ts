import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { posthogState, mockCapture, mockIdentify, mockReset, mockCaptureException } = vi.hoisted(
  () => {
    const posthogState = { loaded: false };
    const mockCapture = vi.fn();
    const mockIdentify = vi.fn();
    const mockReset = vi.fn();
    const mockCaptureException = vi.fn();
    return { posthogState, mockCapture, mockIdentify, mockReset, mockCaptureException };
  },
);

vi.mock("posthog-js/dist/module.no-external", () => ({
  default: {
    get __loaded() {
      return posthogState.loaded;
    },
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
    captureException: mockCaptureException,
  },
}));

import {
  captureAnalyticsError,
  identifyAnalyticsUser,
  isAnalyticsInitialized,
  resetAnalyticsIdentity,
  trackAnalyticsEvent,
} from "@/lib/analytics/client";

describe("isAnalyticsInitialized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogState.loaded = false;
  });

  it("reports not-initialized before posthog init completes", () => {
    expect(isAnalyticsInitialized()).toBe(false);
  });

  it("reports initialized once __loaded flips true", () => {
    posthogState.loaded = true;
    expect(isAnalyticsInitialized()).toBe(true);
  });
});

describe("trackAnalyticsEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogState.loaded = true;
  });

  it("forwards a typed event with its exact payload", () => {
    trackAnalyticsEvent("resume_uploaded", {
      file_size_bytes: 2048,
      file_name_length: 12,
    });

    expect(mockCapture).toHaveBeenCalledWith("resume_uploaded", {
      file_size_bytes: 2048,
      file_name_length: 12,
    });
  });

  it("rejects unknown event names at compile time", () => {
    trackAnalyticsEvent(
      // @ts-expect-error: not a key of AnalyticsEventMap
      "definitely_not_an_event",
      {},
    );
    expect(mockCapture).toHaveBeenCalled();
  });

  it("rejects payloads missing required properties at compile time", () => {
    // @ts-expect-error: resume_claimed requires { resume_id: string }
    trackAnalyticsEvent("resume_claimed", {});
    expect(mockCapture).toHaveBeenCalled();
  });
});

describe("identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogState.loaded = true;
  });

  it("identify forwards user id and traits", () => {
    identifyAnalyticsUser("user_123", { email: "a@b.co", name: "Avery" });

    expect(mockIdentify).toHaveBeenCalledWith("user_123", {
      email: "a@b.co",
      name: "Avery",
    });
  });

  it("identify works without traits", () => {
    identifyAnalyticsUser("user_123");
    expect(mockIdentify).toHaveBeenCalledWith("user_123", undefined);
  });

  it("reset forgets the current identity", () => {
    resetAnalyticsIdentity();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

describe("captureAnalyticsError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogState.loaded = true;
  });

  it("forwards error and optional properties to posthog exception capture", () => {
    const error = new Error("boom");

    captureAnalyticsError(error, { route_path: "/dashboard" });

    expect(mockCaptureException).toHaveBeenCalledWith(error, { route_path: "/dashboard" });
  });

  it("never throws when the underlying reporter throws", () => {
    mockCaptureException.mockImplementationOnce(() => {
      throw new Error("reporter exploded");
    });

    expect(() => captureAnalyticsError(new Error("boom"))).not.toThrow();
  });
});
