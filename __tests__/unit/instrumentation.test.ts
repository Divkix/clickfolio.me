import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockCaptureServerException } = vi.hoisted(() => ({
  mockCaptureServerException: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerException: mockCaptureServerException,
}));

import { onRequestError } from "@/instrumentation";

describe("root instrumentation onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureServerException.mockResolvedValue(undefined);
  });

  const context = {
    routerKind: "App Router",
    routePath: "/dashboard/page",
    routeType: "render",
  } as const;

  it("forwards path, method, and route context — never request headers", async () => {
    const error = new Error("boom");
    // Headers present in the platform payload must NOT reach analytics.
    const request = {
      path: "/dashboard",
      method: "POST",
      headers: { cookie: "session=secret", authorization: "Bearer x" },
    };

    await onRequestError(error, request, context);

    expect(mockCaptureServerException).toHaveBeenCalledTimes(1);
    const [capturedError, properties] = mockCaptureServerException.mock.calls[0];
    expect(capturedError).toBe(error);
    expect(properties).toEqual({
      request_path: "/dashboard",
      request_method: "POST",
      route_path: "/dashboard/page",
      route_type: "render",
      router_kind: "App Router",
    });
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

    // vinext registers the returned promise; the send must not be considered
    // done until captureServerException settles.
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
