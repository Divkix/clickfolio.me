import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  end: vi.fn(async () => {}),
  drizzle: vi.fn(() => ({})),
  backfill: vi.fn(async () => ({ updated: 0, indexable: 0, malformed: 0 })),
}));

vi.mock("pg", () => ({
  Pool: class {
    constructor(options: PoolConfig) {
      mocks.pool(options);
    }

    end = mocks.end;
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: mocks.drizzle }));

vi.mock("@/lib/data/content-indexable-backfill", () => ({
  backfillContentIndexable: mocks.backfill,
}));

const originalArgv = process.argv;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://unused.test/backfill");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// The CLI executes at module load, so each argument set needs a fresh dynamic import.
describe("backfill-content-indexable CLI", () => {
  it.each([undefined, "not-a-date", "", "--other"])(
    "rejects --since with value %j before opening the database",
    async (value) => {
      process.argv = [
        "node",
        "backfill-content-indexable.ts",
        "--since",
        ...(value === undefined ? [] : [value]),
      ];

      await expect(import("../../../scripts/backfill-content-indexable")).rejects.toThrow(
        "process.exit(1)",
      );

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("--since needs an ISO timestamp"),
      );
      expect(mocks.pool).not.toHaveBeenCalled();
      expect(mocks.drizzle).not.toHaveBeenCalled();
      expect(mocks.backfill).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "2026-10-24T12:00:00.000Z"])(
    "passes updatedSince %j to the backfill",
    async (updatedSince) => {
      process.argv = [
        "node",
        "backfill-content-indexable.ts",
        ...(updatedSince ? ["--since", updatedSince] : []),
      ];

      await import("../../../scripts/backfill-content-indexable");

      expect(process.exit).not.toHaveBeenCalled();
      expect(mocks.pool).toHaveBeenCalledWith({
        connectionString: "postgres://unused.test/backfill",
        max: 1,
      });
      expect(mocks.backfill).toHaveBeenCalledWith({}, { updatedSince });
      expect(mocks.end).toHaveBeenCalledOnce();
    },
  );
});
