import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";

interface FakeEnv {
  HYPERDRIVE?: { connectionString: string };
  CLICKFOLIO_R2_BUCKET?: { list: () => Promise<void> };
  CF_AI_GATEWAY_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  CF_AIG_AUTH_TOKEN?: string;
}

const mocks = vi.hoisted(() => {
  const env: FakeEnv = {};

  return { execute: vi.fn(), list: vi.fn(), log: vi.fn(), env };
});

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));

vi.mock("@/lib/db", () => ({ getDb: () => ({ execute: mocks.execute }) }));

vi.mock("@/lib/utils/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/log")>()),
  log: mocks.log,
}));

const { GET } = await import("@/app/api/health/route");

const serviceSchema = z.object({
  status: z.string(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

const healthSchema = z.object({
  status: z.string(),
  services: z.object({ pg: serviceSchema, r2: serviceSchema, aiProvider: serviceSchema }),
});

async function readHealth(response: Response) {
  return healthSchema.parse(await response.json());
}

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.list.mockReset();
  mocks.log.mockReset();

  mocks.env.HYPERDRIVE = { connectionString: "postgres://x" };
  mocks.env.CLICKFOLIO_R2_BUCKET = { list: mocks.list };
  mocks.env.CF_AI_GATEWAY_ACCOUNT_ID = "acct";
  mocks.env.CF_AI_GATEWAY_ID = "gateway";
  mocks.env.CF_AIG_AUTH_TOKEN = "token";
  mocks.execute.mockResolvedValue({ rows: [] });
  mocks.list.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/health", () => {
  it("reports healthy with 200 when every dependency answers", async () => {
    const response = await GET();
    const body = await readHealth(response);

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.services.pg.status).toBe("healthy");
    expect(body.services.r2.status).toBe("healthy");
    expect(body.services.aiProvider).toEqual({ status: "healthy" });
  });

  it("answers 503 and logs the cause when Postgres fails", async () => {
    mocks.execute.mockRejectedValue(new Error("password authentication failed"));

    const response = await GET();
    const body = await readHealth(response);

    expect(response.status).toBe(503);
    expect(body.services.pg).toMatchObject({ status: "unhealthy", error: "Service unavailable" });
    expect(body.services.r2.status).toBe("healthy");
    expect(JSON.stringify(body)).not.toContain("password authentication failed");

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "request failed",
      expect.objectContaining({
        failure: "DbFailed",
        operation: "health.pg",
        "error.message": "password authentication failed",
      }),
    );
  });

  it("gives up on an R2 listing that never answers", async () => {
    vi.useFakeTimers();
    mocks.list.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.r2 + 1);
    const response = await pending;
    const body = await readHealth(response);

    expect(response.status).toBe(503);
    expect(body.services.r2).toMatchObject({ status: "unhealthy", error: "Service unavailable" });
    expect(body.services.pg.status).toBe("healthy");

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "request failed",
      expect.objectContaining({ failure: "R2Failed", kind: "timeout", operation: "health.r2" }),
    );
  });

  it("marks a missing R2 binding unhealthy without naming it", async () => {
    delete mocks.env.CLICKFOLIO_R2_BUCKET;

    const response = await GET();
    const body = await readHealth(response);

    expect(response.status).toBe(503);
    expect(body.services.r2).toEqual({ status: "unhealthy", error: "Not configured" });
  });
});
