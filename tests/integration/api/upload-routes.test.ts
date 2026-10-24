import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RateLimitUnavailable } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { createSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import { logLines } from "../../helpers/log-lines";

const SECRET = "test-pending-upload-secret";

const mocks = vi.hoisted(() => ({
  bucket: {
    put: vi.fn(),
    head: vi.fn(),
  },
  bound: { value: true },
  secret: { value: "" },
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  cookies: vi.fn(),
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

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

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
  mocks.cookieGet.mockReset().mockReturnValue(undefined);
  mocks.cookieSet.mockReset();
  mocks.cookieDelete.mockReset();
  mocks.cookies
    .mockReset()
    .mockResolvedValue({ get: mocks.cookieGet, set: mocks.cookieSet, delete: mocks.cookieDelete });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/upload", () => {
  it("stores the PDF and sets the signed cookie", async () => {
    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(uploadRequest());
    const body: { key: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^temp\/.+\.pdf$/);
    expect(response.headers.get("Set-Cookie")).toMatch(/^pending_upload=.+; HttpOnly/);
    expect(response.headers.get("X-RateLimit-Remaining-Hourly")).toBe("9");
  });

  it("answers 503 before touching the rate limit when the bucket is not bound", async () => {
    mocks.bound.value = false;

    const { POST } = await import("@/app/api/upload/route");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(mocks.limiter).not.toHaveBeenCalled();
  });

  it("answers 503 with Retry-After when the rate-limit store is down", async () => {
    mocks.limiter.mockReturnValue(
      Effect.fail(new RateLimitUnavailable({ message: "try again", retryAfterSeconds: 30 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/route");
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("answers 503 and logs resume_upload_failed when R2 rejects the put", async () => {
    mocks.bucket.put.mockRejectedValue(new Error("R2 is down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/route");
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

    const { POST } = await import("@/app/api/upload/route");
    const pending = POST(uploadRequest());

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.r2 + 1);

    const response = await pending;

    expect(response.status).toBe(504);
    expect(mocks.bucket.put).toHaveBeenCalledTimes(1);
  });

  it("still succeeds, unsigned and with a warning, when PENDING_UPLOAD_SECRET is missing", async () => {
    mocks.secret.value = "";
    const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/route");
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

    const { POST } = await import("@/app/api/upload/route");
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
  const KEY = "temp/11111111-1111-4111-8111-111111111111/cv.pdf";

  function pendingPost(key: string = KEY): Request {
    return new Request("https://clickfolio.me/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  }

  it("POST answers 503 when R2 cannot be asked, not 404", async () => {
    mocks.bucket.head.mockRejectedValue(new Error("R2 is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/pending/route");
    const response = await POST(pendingPost());

    expect(response.status).toBe(503);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("POST answers 500 and sets no cookie when the secret is missing", async () => {
    mocks.secret.value = "";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/pending/route");
    const response = await POST(pendingPost());

    expect(response.status).toBe(500);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("POST answers 400 when the client drops the body mid-read", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("client went away"));
      },
    });

    const request = new Request("https://clickfolio.me/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "200" },
      body,
      // @ts-expect-error duplex is required for streamed request bodies and missing from lib.dom.
      duplex: "half",
    });

    const { POST } = await import("@/app/api/upload/pending/route");
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("POST answers 413 for a declared oversized body before the missing-secret check", async () => {
    mocks.secret.value = "";

    const { POST } = await import("@/app/api/upload/pending/route");

    const response = await POST(
      new Request("https://clickfolio.me/api/upload/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": "9000000" },
        body: JSON.stringify({ key: KEY }),
      }),
    );

    expect(response.status).toBe(413);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("POST answers 400 for malformed JSON", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { POST } = await import("@/app/api/upload/pending/route");

    const response = await POST(
      new Request("https://clickfolio.me/api/upload/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json {",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid JSON in request body",
      code: "VALIDATION_ERROR",
    });
  });

  it("GET answers the key of a valid cookie", async () => {
    const value = await createSignedCookieValue(KEY, SECRET);
    mocks.cookieGet.mockReturnValue({ name: "pending_upload", value });

    const { GET } = await import("@/app/api/upload/pending/route");
    const response = await GET();

    expect(await response.json()).toEqual({ key: KEY });
  });

  it("GET answers null for a missing or forged cookie", async () => {
    const { GET } = await import("@/app/api/upload/pending/route");

    expect(await (await GET()).json()).toEqual({ key: null });

    mocks.cookieGet.mockReturnValue({
      name: "pending_upload",
      value: `${KEY}|9999999999999|forged`,
    });

    expect(await (await GET()).json()).toEqual({ key: null });
  });

  it("GET answers 500 instead of 'no upload' when the secret is missing", async () => {
    mocks.secret.value = "";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("@/app/api/upload/pending/route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(logLines(logged)).toContainEqual(
      expect.objectContaining({ msg: expect.stringContaining("PENDING_UPLOAD_SECRET") }),
    );
  });

  it("GET answers 500 when the cookie store cannot be read", async () => {
    mocks.cookies.mockRejectedValue(new Error("no request store"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("@/app/api/upload/pending/route");
    const response = await GET();

    expect(response.status).toBe(500);
  });

  it("DELETE clears the cookie", async () => {
    const { DELETE } = await import("@/app/api/upload/pending/route");
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(mocks.cookieDelete).toHaveBeenCalledWith("pending_upload");
  });

  it("DELETE does not claim success when the cookie could not be cleared", async () => {
    mocks.cookieDelete.mockImplementation(() => {
      throw new Error("headers already sent");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { DELETE } = await import("@/app/api/upload/pending/route");
    const response = await DELETE();

    expect(response.status).toBe(500);
  });
});
