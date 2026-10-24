import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { logLines } from "../../helpers/log-lines";

interface TestEnv {
  HYPERDRIVE: { connectionString: string };
  CLICKFOLIO_R2_BUCKET?: { list: typeof mockList };
  CF_AI_GATEWAY_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  CF_AIG_AUTH_TOKEN?: string;
}

const mockList = vi.fn();

const mockExecute = vi.fn();

const mockGetR2Binding = vi.fn((env: TestEnv) => env.CLICKFOLIO_R2_BUCKET ?? null);

const mockEnv: TestEnv = { HYPERDRIVE: { connectionString: "" } };

vi.mock("cloudflare:workers", () => ({ env: mockEnv }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({ execute: mockExecute })) }));

vi.mock("@/lib/r2", () => ({ getR2Binding: (env: TestEnv) => mockGetR2Binding(env) }));

const DB_ERROR = 'password authentication failed for user "clickfolio" at db.internal:5432';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockEnv, {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    CLICKFOLIO_R2_BUCKET: { list: mockList },
    CF_AI_GATEWAY_ACCOUNT_ID: "account",
    CF_AI_GATEWAY_ID: "gateway",
    CF_AIG_AUTH_TOKEN: "token",
  });
  mockList.mockResolvedValue({ objects: [] });
  mockExecute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function health(): Promise<Response> {
  const { GET } = await import("@/app/api/health/route");

  return GET(new Request("https://clickfolio.test/api/health"));
}

describe("GET /api/health", () => {
  it("reports every service healthy without status text", async () => {
    const response = await health();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "healthy",
      timestamp: expect.any(String),
      services: {
        r2: { status: "healthy", latencyMs: expect.any(Number) },
        pg: { status: "healthy", latencyMs: expect.any(Number) },
        aiProvider: { status: "healthy" },
      },
    });
  });

  it("answers 503 with a fixed string, logging the database error server-side", async () => {
    mockExecute.mockRejectedValue(new Error(DB_ERROR));

    const response = await health();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      status: "unhealthy",
      services: { pg: { status: "unhealthy", error: "unreachable" } },
    });
    expect(text).not.toContain("password");
    expect(text).not.toContain("db.internal");
    expect(logLines(errorSpy)).toContainEqual(
      expect.objectContaining({
        msg: "Health probe failed",
        service: "pg",
        "error.message": DB_ERROR,
      }),
    );
  });

  it("reports an R2 failure as unreachable", async () => {
    mockList.mockRejectedValue(new Error("R2 bucket clickfolio-prod: internal error"));

    const response = await health();
    const text = await response.text();

    expect(JSON.parse(text)).toMatchObject({
      services: { r2: { status: "unhealthy", error: "unreachable" } },
    });
    expect(text).not.toContain("clickfolio-prod");
  });

  it("does not name missing bindings or secrets", async () => {
    mockEnv.CLICKFOLIO_R2_BUCKET = undefined;
    mockEnv.CF_AIG_AUTH_TOKEN = undefined;

    const response = await health();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      services: {
        r2: { status: "unhealthy", error: "not configured" },
        aiProvider: { status: "unhealthy", error: "not configured" },
      },
    });
    expect(text).not.toContain("CF_AI");
  });

  it("answers 503 without the error text when the check itself breaks", async () => {
    mockGetR2Binding.mockImplementationOnce(() => {
      throw new Error(DB_ERROR);
    });

    const response = await health();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: "Health check failed", code: "INTERNAL_ERROR" });
    expect(text).not.toContain("password");
    expect(logLines(errorSpy)).toContainEqual(
      expect.objectContaining({
        msg: "API route failure",
        errorType: "HealthCheckFailed",
        "error.message": DB_ERROR,
      }),
    );
  });
});
