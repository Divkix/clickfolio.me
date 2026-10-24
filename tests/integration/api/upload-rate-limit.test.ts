import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { logLines } from "../../helpers/log-lines";

type CountRow = { hourly: number; daily: number };

const mockSelect = vi.fn();

const mockTransaction = vi.fn();

const mockPut = vi.fn();

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    CLICKFOLIO_R2_BUCKET: { put: mockPut },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({ select: mockSelect, transaction: mockTransaction })),
}));

const CLIENT_IP = "203.0.113.7";

function countsAre(rows: CountRow[]): void {
  mockSelect.mockReturnValue({ from: () => ({ where: async () => rows }) });
}

function uploadRequest(): Request {
  const body = new Uint8Array(120);

  body.set(new TextEncoder().encode("%PDF-1.4"));

  return new Request("https://clickfolio.test/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.byteLength),
      "X-Filename": "resume.pdf",
      "cf-connecting-ip": CLIENT_IP,
    },
    body,
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Rate limits only run in production, for a non-local caller.
  vi.stubGlobal("process", {
    ...process,
    env: { ...process.env, NODE_ENV: "production", APP_URL: "https://clickfolio.me" },
  });
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/upload rate limiting", () => {
  it("answers 503 with Retry-After, not 429, when the limit store cannot be read", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("connection refused");
    });

    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const body: { error: string } = await response.json();

    expect(body).toEqual({
      error: "Upload temporarily unavailable. Please try again in a moment.",
      code: "RATE_LIMIT_UNAVAILABLE",
      details: { retryAfterSeconds: 60 },
    });
    // The upload client reads "limit" as an exhausted daily quota.
    expect(body.error.toLowerCase()).not.toContain("limit");
    expect(mockPut).not.toHaveBeenCalled();
    expect(logLines(warnSpy)).toContainEqual(
      expect.objectContaining({ msg: "API route failure", errorType: "RateLimitUnavailable" }),
    );
    expect(logLines(errorSpy)).toContainEqual(
      expect.objectContaining({
        msg: "Rate limit check failed",
        "error.message": "connection refused",
      }),
    );
    expect(JSON.stringify([warnSpy.mock.calls, errorSpy.mock.calls])).not.toContain(CLIENT_IP);
  });

  it("answers 503 when the upload cannot be recorded", async () => {
    countsAre([{ hourly: 0, daily: 0 }]);
    mockTransaction.mockRejectedValue(new Error("deadlock detected"));

    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE" });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("keeps 429 for an exhausted hourly quota", async () => {
    countsAre([{ hourly: 10, daily: 10 }]);

    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "Too many upload requests. Try again in an hour. (Limit: 10/hour)",
      code: "RATE_LIMIT_EXCEEDED",
      details: { remaining: { hourly: 0, daily: 40 } },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
