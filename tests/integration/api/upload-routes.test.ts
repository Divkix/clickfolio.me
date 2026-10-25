import { serverHandler } from "@/tests/helpers/server-route";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RateLimitUnavailable } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { logLines } from "../../helpers/log-lines";

const SECRET = "test-pending-upload-secret";

const mocks = vi.hoisted(() => ({
  bucket: {
    put: vi.fn(),
    head: vi.fn(),
  },
  bound: { value: true },
  secret: { value: "" },
  limiter: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: {},
    NODE_ENV: "test",
    get CLICKFOLIO_R2_BUCKET() {
      return mocks.bound.value ? mocks.bucket : undefined;
    },
    get PENDING_UPLOAD_SECRET() {
      return mocks.secret.value;
    },
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

vi.mock("@/lib/rate-limit/ip", () => ({
  checkIPRateLimitEffect: mocks.limiter,
  getClientIP: () => "203.0.113.7",
}));

const FILE_NAME = "Avery Johnson Resume.pdf";

function pdf(): ArrayBuffer {
  const bytes = new Uint8Array(200);

  bytes.set(new TextEncoder().encode("%PDF-1.4 fake content"));

  return bytes.buffer;
}

function uploadRequest(buffer: ArrayBuffer = pdf()): Request {
  return new Request("https://clickfolio.me/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "X-Filename": encodeURIComponent(FILE_NAME),
    },
    body: buffer,
  });
}

beforeEach(() => {
  mocks.bound.value = true;
  mocks.secret.value = SECRET;
  mocks.bucket.put.mockReset().mockResolvedValue({ size: 200, etag: "etag" });
  mocks.bucket.head.mockReset().mockResolvedValue({ size: 200, etag: "etag" });
  mocks.limiter
    .mockReset()
    .mockReturnValue(Effect.succeed({ remaining: { hourly: 9, daily: 49 } }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/upload", () => {
  it("stores the PDF and sets the signed cookie", async () => {
    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");

    const response = await POST(uploadRequest());
    const body: { key: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^temp\/.+\.pdf$/);
    expect(response.headers.get("Set-Cookie")).toMatch(/^pending_upload=.+; HttpOnly/);
    expect(response.headers.get("X-RateLimit-Remaining-Hourly")).toBe("9");
  });

  it("answers 503 before touching the rate limit when the bucket is not bound", async () => {
    mocks.bound.value = false;

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(mocks.limiter).not.toHaveBeenCalled();
  });

  it("answers 503 with Retry-After when the rate-limit store is down", async () => {
    mocks.limiter.mockReturnValue(
      Effect.fail(new RateLimitUnavailable({ message: "try again", retryAfterSeconds: 30 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("answers 503 and logs resume_upload_failed when R2 rejects the put", async () => {
    mocks.bucket.put.mockRejectedValue(new Error("R2 is down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie")).toBeNull();

    const lines = logLines(logged);

    expect(lines).toContainEqual(
      expect.objectContaining({ event: "resume_upload_failed", size_bytes: 200 }),
    );
    // The uploaded file name ends every R2 key: it must not reach the logs.
    expect(JSON.stringify(lines)).not.toContain("Avery");
  });

  it("gives up with 504 after the R2 timeout and never retries the put", async () => {
    vi.useFakeTimers();
    mocks.bucket.put.mockReturnValue(new Promise(() => {}));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const pending = POST(uploadRequest());

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.r2 + 1);

    const response = await pending;

    expect(response.status).toBe(504);
    expect(mocks.bucket.put).toHaveBeenCalledTimes(1);
  });

  it("still succeeds, unsigned and with a warning, when PENDING_UPLOAD_SECRET is missing", async () => {
    mocks.secret.value = "";
    const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(logLines(logged)).toContainEqual(
      expect.objectContaining({ msg: expect.stringContaining("PENDING_UPLOAD_SECRET") }),
    );
  });

  it("answers 400 when the client drops the body mid-upload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("client went away"));
      },
    });

    const request = new Request("https://clickfolio.me/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": "200",
        "X-Filename": "cv.pdf",
      },
      body,
      // @ts-expect-error duplex is required for streamed request bodies and missing from lib.dom.
      duplex: "half",
    });

    const POST = serverHandler((await import("@/app/routes/api/upload")).Route, "POST");
    const response = await POST(request);
    const responseBody = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(responseBody).not.toContain("client went away");
    expect(logLines(warn)).toContainEqual(
      expect.objectContaining({ failure: "InvalidInput", "error.message": "client went away" }),
    );
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });
});

describe("/api/upload/pending", () => {
  it("does not expose a cookie-minting POST handler", async () => {
    // Load after the test's Cloudflare and cookie mocks have been installed.
    const { Route } = await import("@/app/routes/api/upload/pending");

    expect(Route.options.server?.handlers).not.toHaveProperty("POST");
  });

  it("DELETE clears the cookie", async () => {
    const DELETE = serverHandler((await import("@/app/routes/api/upload/pending")).Route, "DELETE");

    const response = await DELETE(
      new Request("https://clickfolio.me/api/upload/pending", { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBe(
      "pending_upload=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });
});
