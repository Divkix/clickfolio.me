import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

interface FakeEnv {
  HYPERDRIVE?: { connectionString: string };
  CLICKFOLIO_R2_BUCKET?: { list: () => Promise<void> };
}

const mocks = vi.hoisted(() => {
  const env: FakeEnv = {};

  return { execute: vi.fn(), list: vi.fn(), env };
});

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute: mocks.execute }),
}));

const { GET } = await import("@/app/api/health/route");

const PG_SECRET = "connect ECONNREFUSED postgres://admin:hunter2@db.internal.example:5432/prod";
const R2_SECRET = "R2 internal error for bucket clickfolio-secret-bucket";

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.list.mockReset();

  delete mocks.env.HYPERDRIVE;
  delete mocks.env.CLICKFOLIO_R2_BUCKET;
  mocks.env.HYPERDRIVE = { connectionString: "postgres://x" };
  mocks.env.CLICKFOLIO_R2_BUCKET = { list: mocks.list };
});

describe("GET /api/health never leaks internals", () => {
  it("shows fixed strings when the database and R2 fail", async () => {
    mocks.execute.mockRejectedValue(new Error(PG_SECRET));
    mocks.list.mockRejectedValue(new Error(R2_SECRET));

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("db.internal.example");
    expect(body).not.toContain("clickfolio-secret-bucket");
    expect(body).not.toContain("ECONNREFUSED");
  });

  it("names no binding or secret when they are missing", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    delete mocks.env.CLICKFOLIO_R2_BUCKET;

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("CF_AI_GATEWAY_ACCOUNT_ID");
    expect(body).not.toContain("CF_AIG_AUTH_TOKEN");
    expect(body).not.toContain("binding");
  });

  it("answers an unexpected failure with a fixed message", async () => {
    // A throwing getter stands in for any bug outside the three checks.
    Object.defineProperty(mocks.env, "HYPERDRIVE", {
      configurable: true,
      get() {
        throw new Error("secret internal detail");
      },
    });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("secret internal detail");
  });
});
