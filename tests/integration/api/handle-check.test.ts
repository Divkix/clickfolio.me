import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AppSession } from "@/lib/auth/session";
import { uploadRateLimits, type user } from "@/lib/db/schema";
import { logLines } from "../../helpers/log-lines";

type CountRow = { count: number };

type IdRow = { id: string };

let rateLimitRows: () => Promise<CountRow[]>;

let takenBy: IdRow[];

const mockTransaction = vi.fn();

const mockGetServerSession = vi.fn<() => Promise<AppSession | null>>();

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: () => mockGetServerSession(),
}));

// The rate-limit count reads upload_rate_limits; the availability lookup reads user.
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: (table: typeof uploadRateLimits | typeof user) =>
        table === uploadRateLimits
          ? { where: () => rateLimitRows() }
          : { where: () => ({ limit: async () => takenBy }) },
    }),
    transaction: mockTransaction,
  })),
}));

const HANDLE = "avery-dev";

const CLIENT_IP = "203.0.113.7";

function checkRequest(): Request {
  return new Request(`https://clickfolio.test/api/handle/check?handle=${HANDLE}`, {
    headers: { "cf-connecting-ip": CLIENT_IP },
  });
}

function signedInAs(id: string): AppSession {
  return {
    user: {
      id,
      name: "Avery",
      email: "avery@example.com",
      image: null,
      handle: HANDLE,
      headline: null,
      privacySettings: {
        show_phone: false,
        show_address: false,
        hide_from_search: false,
        show_in_directory: true,
      },
      onboardingCompleted: true,
      role: null,
      isAdmin: false,
    },
    session: { id: "sess_1", userId: id, token: "token", expiresAt: new Date(0) },
  };
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
  rateLimitRows = async () => [{ count: 0 }];
  takenBy = [];
  mockTransaction.mockImplementation(
    async (callback: (tx: { execute: () => Promise<{ rowCount: number }> }) => Promise<boolean>) =>
      callback({ execute: async () => ({ rowCount: 1 }) }),
  );
  mockGetServerSession.mockResolvedValue(null);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function check(): Promise<Response> {
  const { GET } = await import("@/app/api/handle/check/route");

  return GET(checkRequest());
}

function loggedText(): string {
  return JSON.stringify([warnSpy.mock.calls, errorSpy.mock.calls]);
}

describe("GET /api/handle/check rate limiting", () => {
  it("fails closed with 503 and Retry-After when the limit store cannot be read", async () => {
    rateLimitRows = async () => {
      throw new Error("connection refused");
    };

    const response = await check();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");

    const body: { error: string } = await response.json();

    expect(body).toEqual({
      error:
        "Handle availability checks are temporarily unavailable. Please try again in a moment.",
      code: "RATE_LIMIT_UNAVAILABLE",
      details: { retryAfterSeconds: 60 },
    });
    expect(body.error.toLowerCase()).not.toContain("limit");
    expect(logLines(errorSpy)).toContainEqual(
      expect.objectContaining({ msg: "Handle rate limit check failed:" }),
    );
    expect(loggedText()).not.toContain(CLIENT_IP);
    expect(loggedText()).not.toContain(HANDLE);
  });

  it("fails closed with 503 when the check cannot be recorded", async () => {
    mockTransaction.mockRejectedValue(new Error("deadlock detected"));

    const response = await check();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE" });
  });

  it("keeps 429 when the hourly quota is used up", async () => {
    rateLimitRows = async () => [{ count: 100 }];

    const response = await check();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "Too many handle checks. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  });

  it("records the check and reports a free handle", async () => {
    const response = await check();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});

describe("GET /api/handle/check session lookup", () => {
  it("tells the owner the taken handle is theirs", async () => {
    takenBy = [{ id: "user_1" }];
    mockGetServerSession.mockResolvedValue(signedInAs("user_1"));

    const response = await check();

    await expect(response.json()).resolves.toEqual({ available: true, isCurrentHandle: true });
  });

  it("logs a failed session lookup and answers as for an anonymous caller", async () => {
    takenBy = [{ id: "user_1" }];
    mockGetServerSession.mockRejectedValue(new Error("clerk unreachable"));

    const response = await check();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: false });
    expect(logLines(warnSpy)).toContainEqual(
      expect.objectContaining({
        msg: "Session lookup failed during handle check; treating caller as anonymous",
        "error.message": "clerk unreachable",
      }),
    );
  });
});
