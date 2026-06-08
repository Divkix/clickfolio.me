import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { waitForResumeCompletion } from "@/lib/utils/wait-for-completion";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

describe("waitForResumeCompletion", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    Object.defineProperty(window, "location", {
      value: { protocol: "https:", host: "clickfolio.test" },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      configurable: true,
    });
  });

  it("resolves from a terminal WebSocket status and cleans up keepalive timers", async () => {
    const resultPromise = waitForResumeCompletion("res_123", 60_000);
    const ws = MockWebSocket.instances[0];

    expect(ws.url).toBe("wss://clickfolio.test/ws/resume-status?resume_id=res_123");
    ws.onopen?.();
    await vi.advanceTimersByTimeAsync(30_001);
    expect(ws.send).toHaveBeenCalledWith("ping");

    ws.onmessage?.({ data: "pong" });
    ws.onmessage?.({ data: "{bad json" });
    ws.onmessage?.({ data: JSON.stringify({ type: "ignored", status: "completed" }) });
    ws.onmessage?.({ data: JSON.stringify({ type: "status", status: "completed" }) });

    await expect(resultPromise).resolves.toEqual({ status: "completed" });
    expect(ws.close).toHaveBeenCalledWith(1000, "done");
  });

  it("falls back to polling after repeated WebSocket closes", async () => {
    let pollCount = 0;
    globalThis.fetch = vi.fn(async () => {
      pollCount += 1;
      return Response.json(
        pollCount === 1 ? { status: "processing" } : { status: "failed", error: "Parser failed" },
      );
    }) as unknown as typeof fetch;

    const resultPromise = waitForResumeCompletion("res_retry", 20_000);
    MockWebSocket.instances[0].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(1000);
    MockWebSocket.instances[1].onerror?.();
    MockWebSocket.instances[1].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(2000);
    MockWebSocket.instances[2].onclose?.({ code: 1006 });

    await vi.advanceTimersByTimeAsync(3000);
    await expect(resultPromise).resolves.toEqual({ status: "failed", error: "Parser failed" });
    expect(fetch).toHaveBeenCalledWith("/api/resume/status?resume_id=res_retry");
  });

  it("times out when no terminal status arrives", async () => {
    const resultPromise = waitForResumeCompletion("res_timeout", 50);
    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toEqual({
      status: "failed",
      error: "Timed out waiting for resume processing",
    });
    expect(MockWebSocket.instances[0].close).toHaveBeenCalledWith(1000, "done");
  });
});
