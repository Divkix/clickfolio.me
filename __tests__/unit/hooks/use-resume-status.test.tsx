import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  let onStatusChange: ((status: string, error?: string) => void) | null = null;
  return {
    get onStatusChange() {
      return onStatusChange;
    },
    set onStatusChange(value) {
      onStatusChange = value;
    },
    useResumeWebSocket: vi.fn(
      (args: { onStatusChange: (status: string, error?: string) => void }) => {
        onStatusChange = args.onStatusChange;
        return { connectionState: "connected" as const, close: vi.fn() };
      },
    ),
  };
});

vi.mock("@/hooks/useResumeWebSocket", () => ({
  useResumeWebSocket: (...args: Parameters<typeof mocks.useResumeWebSocket>) =>
    mocks.useResumeWebSocket(...args),
}));

import { useResumeStatus } from "@/hooks/useResumeStatus";

interface StatusBody {
  status: string;
  progress_pct: number;
  error: string | null;
  can_retry: boolean;
}

function statusResponse(body: StatusBody) {
  return Response.json(body);
}

function statusFetchCount() {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/resume/status"),
    ).length;
}

describe("useResumeStatus WebSocket failed push", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onStatusChange = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("refetches authoritative status on a failed push instead of optimistically enabling retry", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        statusResponse({ status: "processing", progress_pct: 50, error: null, can_retry: false }),
      )
      .mockResolvedValueOnce(
        statusResponse({
          status: "failed",
          progress_pct: 0,
          error: "Parse failed",
          can_retry: false,
        }),
      ) as unknown as typeof fetch;

    const { result } = renderHook(() => useResumeStatus("res_123"));

    await waitFor(() => expect(result.current.status).toBe("processing"));
    expect(result.current.canRetry).toBe(false);
    expect(statusFetchCount()).toBe(1);

    await act(async () => {
      mocks.onStatusChange?.("failed", "Parse failed");
    });

    await waitFor(() => expect(statusFetchCount()).toBe(2));
    await waitFor(() => expect(result.current.status).toBe("failed"));

    expect(result.current.canRetry).toBe(false);
  });

  it("reflects real eligibility when a failed push arrives before the first status fetch resolves", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(
        statusResponse({
          status: "failed",
          progress_pct: 0,
          error: "Parse failed",
          can_retry: true,
        }),
      ) as unknown as typeof fetch;

    const { result } = renderHook(() => useResumeStatus("res_456"));

    expect(result.current.status).toBeNull();

    await act(async () => {
      mocks.onStatusChange?.("failed", "Parse failed");
    });

    await waitFor(() => expect(result.current.canRetry).toBe(true));
    expect(result.current.status).toBe("failed");
  });
});
