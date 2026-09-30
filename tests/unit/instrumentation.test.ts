import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockCaptureServerException, mockDistinctIdFromCookieHeader } = vi.hoisted(() => ({
  mockCaptureServerException: vi.fn(),
  mockDistinctIdFromCookieHeader: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerException: mockCaptureServerException,
  distinctIdFromCookieHeader: mockDistinctIdFromCookieHeader,
}));

import { onRequestError } from "@/instrumentation";

describe("root instrumentation onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureServerException.mockResolvedValue(undefined);
    mockDistinctIdFromCookieHeader.mockReturnValue(undefined);
  });

  const context = {
    routerKind: "App Router",
    routePath: "/dashboard/page",
    routeType: "render",
  } as const;

  it("forwards path, method, and route context — never request headers", async () => {
    const error = new Error("boom");

    const request = {
      path: "/dashboard",
      method: "POST",
      headers: { cookie: "session=secret", authorization: "Bearer x" },
    };

    await onRequestError(error, request, context);

    expect(mockCaptureServerException).toHaveBeenCalledTimes(1);
    const [capturedError, properties, distinctId] = mockCaptureServerException.mock.calls[0];
    expect(capturedError).toBe(error);
    expect(distinctId).toBeUndefined();
    expect(properties).toEqual({
      request_path: "/dashboard",
      request_method: "POST",
      route_path: "/dashboard/page",
      route_type: "render",
      router_kind: "App Router",
    });
  });

  it("attributes the exception to the distinct id recovered from the cookie header", async () => {
    mockDistinctIdFromCookieHeader.mockReturnValueOnce("anon-123");
    const cookie = "ph_phc_test_posthog=%7B%7D";

    await onRequestError(
      new Error("boom"),
      { path: "/x", method: "GET", headers: { cookie } },
      context,
    );

    expect(mockDistinctIdFromCookieHeader).toHaveBeenCalledWith(cookie);
    expect(mockCaptureServerException.mock.calls[0][2]).toBe("anon-123");
  });

  it("returns the capture promise so vinext retains it with the request context", async () => {
    let resolveCapture!: (value: undefined) => void;
    mockCaptureServerException.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    const returned = onRequestError(new Error("boom"), { path: "/x", method: "GET" }, context);

    let settled = false;
    void returned.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCapture(undefined);
    await expect(returned).resolves.toBeUndefined();
  });
});
