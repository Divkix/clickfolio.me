import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toUploadError, uploadWithRetry } from "@/lib/utils/upload";

vi.mock("@/lib/utils/pending-upload-client", () => ({
  setPendingUploadCookie: vi.fn(async () => undefined),
  clearPendingUploadCookie: vi.fn(async () => undefined),
}));

/**
 * Minimal XMLHttpRequest mock that fires upload progress + load synchronously.
 * Lets us drive `uploadPdf` (which uses XHR for real byte progress) without a
 * network or jsdom's real XHR.
 */
function installXhr(
  responder: (
    url: string,
    headers: Record<string, string>,
  ) => {
    status: number;
    body: unknown;
  },
): { calls: Array<{ url: string; headers: Record<string, string> }>; restore: () => void } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const Original = globalThis.XMLHttpRequest;
  class MockXHR {
    static UNSENT = 0;
    static OPENED = 1;
    static HEADERS_RECEIVED = 2;
    static LOADING = 3;
    static DONE = 4;
    status = 0;
    response: unknown = null;
    upload = {
      onprogress: null as ((e: ProgressEvent) => void) | null,
      onloadstart: null as ((e: ProgressEvent) => void) | null,
    };
    onload: ((e: ProgressEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: ((e: ProgressEvent) => void) | null = null;
    ontimeout: (() => void) | null = null;
    private url = "";
    private headers: Record<string, string> = {};
    private responseTypeValue = "";

    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
    }
    // eslint-disable-next-line accessor-pairs
    set responseType(v: string) {
      this.responseTypeValue = v;
    }
    get responseType() {
      return this.responseTypeValue;
    }
    send() {
      calls.push({ url: this.url, headers: this.headers });
      // Fire upload progress synchronously
      this.upload.onloadstart?.(new ProgressEvent("loadstart"));
      this.upload.onprogress?.(
        new ProgressEvent("progress", { loaded: 100, total: 100, lengthComputable: true }),
      );
      const { status, body } = responder(this.url, this.headers);
      this.status = status;
      this.response = body;
      this.onload?.(new ProgressEvent("load"));
    }
    abort() {
      this.onabort?.(new ProgressEvent("abort"));
    }
  }
  globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
  return {
    calls,
    restore: () => {
      globalThis.XMLHttpRequest = Original;
    },
  };
}

describe("toUploadError", () => {
  it("maps 400 to a non-retryable invalid-pdf error", () => {
    const err = toUploadError(400, "File appears to be empty or corrupted");
    expect(err.reason).toBe("invalid_pdf");
    expect(err.retryable).toBe(false);
    expect(err.message).toContain("Try a different file");
  });

  it("maps 413 to a non-retryable too-large error with the resolved label", () => {
    const err = toUploadError(413);
    expect(err.reason).toBe("too_large");
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/max/i);
  });

  it("maps 429 to a non-retryable rate-limited error, preferring the server message", () => {
    const err = toUploadError(429, "Custom rate message");
    expect(err.reason).toBe("rate_limited");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("Custom rate message");
  });

  it("maps 5xx to a retryable server error", () => {
    expect(toUploadError(503).reason).toBe("server");
    expect(toUploadError(503).retryable).toBe(true);
  });

  it("maps network/abort failures", () => {
    expect(toUploadError(undefined, undefined, "network").reason).toBe("network");
    expect(toUploadError(undefined, undefined, "network").retryable).toBe(true);
    expect(toUploadError(undefined, undefined, "aborted").reason).toBe("aborted");
    expect(toUploadError(undefined, undefined, "aborted").retryable).toBe(false);
  });
});

describe("uploadWithRetry", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the key + remaining on a 200 and reports progress", async () => {
    const xhr = installXhr(() => ({
      status: 200,
      body: { key: "temp/abc/resume.pdf", remaining: { hourly: 9, daily: 49 } },
    }));
    const progress: number[] = [];
    const result = await uploadWithRetry(
      new File(["%PDF-1.4"], "r.pdf", { type: "application/pdf" }),
      {
        onProgress: (p) => progress.push(p),
      },
    );
    expect(result.key).toBe("temp/abc/resume.pdf");
    expect(progress).toContain(0);
    expect(progress).toContain(100);
    expect(xhr.calls[0]?.headers["X-Filename"]).toBe("r.pdf");
    xhr.restore();
  });

  it("does NOT retry permanent failures (413) and throws the specific message", async () => {
    const xhr = installXhr(() => ({ status: 413, body: { error: "too big" } }));
    await expect(
      uploadWithRetry(new File(["%PDF-1.4"], "r.pdf", { type: "application/pdf" })),
    ).rejects.toMatchObject({ reason: "too_large", retryable: false });
    // Only one attempt — no retry for permanent errors.
    expect(xhr.calls).toHaveLength(1);
    xhr.restore();
  });

  it("retries transient failures (5xx) with backoff then gives up", async () => {
    vi.useFakeTimers();
    const xhr = installXhr(() => ({ status: 502, body: { error: "bad gateway" } }));
    const retries: Array<{ attempt: number; delay: number }> = [];
    const promise = uploadWithRetry(new File(["%PDF-1.4"], "r.pdf", { type: "application/pdf" }), {
      maxAttempts: 3,
      baseDelayMs: 100,
      onRetry: (attempt, delay) => retries.push({ attempt, delay }),
    });
    // Attach a handler early so the rejection isn't reported as unhandled.
    promise.catch(() => {});
    // Advance through the backoff sleeps (100, 200, ...).
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toMatchObject({ reason: "server", retryable: true });
    expect(xhr.calls).toHaveLength(3);
    expect(retries).toHaveLength(2); // retries between attempts (not after the last)
    xhr.restore();
  });
});
