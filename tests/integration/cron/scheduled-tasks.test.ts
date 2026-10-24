import type { Mock } from "vite-plus/test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Layer } from "effect";
import { runCleanup } from "@/lib/cron/cleanup";
import { Db } from "@/lib/effect/db";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";

type FakeBucket = Parameters<typeof R2Store.layerFrom>[0];

interface MockCronDb {
  transaction: Mock;
  select: Mock;
  delete: Mock;
}

interface MockR2DeleteWorkflow {
  create: Mock;
}

/** Row shape the mocked stale-failed SELECT hands back. */
interface SelectedRow {
  id: string;
  r2Key?: string | null;
  updatedAt?: string | null;
  createdAt?: string;
}

function selectChain(rows: SelectedRow[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (
          onFulfilled: (value: SelectedRow[]) => SelectedRow[],
          onRejected?: (reason: Error) => SelectedRow[],
        ) => Promise.resolve(rows).then(onFulfilled, onRejected),
      }),
    }),
  };
}

// DELETE ... RETURNING: `where(...)` stays awaitable (pg rowCount) while exposing
// `returning(...)`, which yields the rows the delete actually removed.
function deleteChain(count: number, returned: Array<{ id: string; r2Key: string | null }> = []) {
  return {
    where: vi.fn(() => ({
      rowCount: count,
      returning: vi.fn(async () => returned),
      then: (
        onFulfilled?: ((value: { rowCount: number }) => { rowCount: number }) | null,
        onRejected?: ((reason: Error) => { rowCount: number }) | null,
      ) => Promise.resolve({ rowCount: count }).then(onFulfilled, onRejected),
    })),
  };
}

function createMockDb(): MockCronDb {
  const db: MockCronDb = {
    transaction: vi.fn(async (cb: (tx: MockCronDb) => Promise<void>) => cb(db)),
    select: vi.fn(() => selectChain([])),
    delete: vi.fn(() => deleteChain(0)),
  };

  return db;
}

function createMockR2DeleteWorkflow(): MockR2DeleteWorkflow {
  return { create: vi.fn().mockResolvedValue({ id: "r2-delete-1" }) };
}

function asDb(db: MockCronDb): never {
  // SAFETY: MockCronDb stubs only the Drizzle methods the cleanup cron calls; the real drizzle
  // `Database` type also requires a live node-postgres `$client` no unit test can construct.
  return db as never;
}

function createFakeBucket(): FakeBucket & { delete: Mock } {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => ({ size: 0, etag: "e" })),
    delete: vi.fn(async () => {}),
    head: vi.fn(async () => null),
    list: vi.fn(async () => ({ objects: [], truncated: false as const })),
  };
}

describe("Cron Scheduled Tasks", () => {
  let mockDb: MockCronDb;
  let mockR2DeleteWorkflow: MockR2DeleteWorkflow;
  let mockBucket: ReturnType<typeof createFakeBucket>;

  /** One cleanup run over the mocked database, fake bucket and fake workflow binding. */
  function performCleanup(db: never) {
    return runCleanup(
      Layer.mergeAll(
        Db.layerFrom(db),
        R2Store.layerFrom(mockBucket),
        R2DeleteScheduler.layerFrom(mockR2DeleteWorkflow),
      ),
    );
  }

  beforeEach(() => {
    mockDb = createMockDb();
    mockR2DeleteWorkflow = createMockR2DeleteWorkflow();
    mockBucket = createFakeBucket();
    vi.clearAllMocks();
  });

  describe("performCleanup", () => {
    it("deletes rate limits and handle changes in ONE transaction using pg rowCount", async () => {
      mockDb.delete
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue({ rowCount: 5 }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue({ rowCount: 10 }),
        });

      const result = await performCleanup(asDb(mockDb));

      expect(result.ok).toBe(true);
      expect(result.deleted).toEqual({ rateLimits: 5, handleChanges: 10, failedResumes: 0 });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it("handles empty tables gracefully", async () => {
      const result = await performCleanup(asDb(mockDb));

      expect(result.ok).toBe(true);
      expect(result.deleted.rateLimits).toBe(0);
      expect(result.deleted.handleChanges).toBe(0);
    });

    it("is idempotent - safe to run multiple times", async () => {
      const result1 = await performCleanup(asDb(mockDb));
      const result2 = await performCleanup(asDb(mockDb));
      const result3 = await performCleanup(asDb(mockDb));

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result3.ok).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledTimes(3);
    });

    it("purges failed resumes past TTL, handing failed R2 deletes to R2DeleteWorkflow", async () => {
      const staleFailed = {
        id: "resume-failed",
        r2Key: "uploads/failed.pdf",
        updatedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      mockDb.select.mockReturnValueOnce(selectChain([staleFailed]));
      mockDb.delete
        .mockReturnValueOnce(deleteChain(0))
        .mockReturnValueOnce(deleteChain(0))
        .mockReturnValueOnce(
          deleteChain(1, [{ id: "resume-failed", r2Key: "uploads/failed.pdf" }]),
        );
      mockBucket.delete.mockRejectedValueOnce(new Error("R2 unavailable"));

      const result = await performCleanup(asDb(mockDb));

      expect(result.ok).toBe(true);
      expect(result.deleted.failedResumes).toBe(1);
      expect(mockBucket.delete).toHaveBeenCalledWith("uploads/failed.pdf");
      expect(mockR2DeleteWorkflow.create).toHaveBeenCalledWith({
        params: { keys: ["uploads/failed.pdf"] },
      });
      expect(mockDb.delete).toHaveBeenCalledTimes(3);
    });

    it("deletes R2 objects of purged failed resumes without a workflow on success", async () => {
      const staleFailed = {
        id: "resume-failed",
        r2Key: "uploads/failed.pdf",
        updatedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      mockDb.select.mockReturnValueOnce(selectChain([staleFailed]));
      mockDb.delete
        .mockReturnValueOnce(deleteChain(0))
        .mockReturnValueOnce(deleteChain(0))
        .mockReturnValueOnce(
          deleteChain(1, [{ id: "resume-failed", r2Key: "uploads/failed.pdf" }]),
        );
      mockBucket.delete.mockResolvedValueOnce(undefined);

      const result = await performCleanup(asDb(mockDb));

      expect(result.deleted.failedResumes).toBe(1);
      expect(mockBucket.delete).toHaveBeenCalledWith("uploads/failed.pdf");
      expect(mockR2DeleteWorkflow.create).not.toHaveBeenCalled();
    });
  });

  describe("cron execution logging", () => {
    it("logs one cleanup_completed event with the deleted counts", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await performCleanup(asDb(mockDb));

      const events = consoleSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(events).toEqual([
        expect.objectContaining({
          event: "cleanup_completed",
          duration_ms: expect.any(Number),
          rate_limits_deleted: 0,
          handle_changes_deleted: 0,
          failed_resumes_deleted: 0,
        }),
      ]);

      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("propagates database errors during cleanup", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockDb.transaction.mockRejectedValueOnce(new Error("Database connection failed"));

      await expect(performCleanup(asDb(mockDb))).rejects.toThrow("Database connection failed");
      expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
        event: "cleanup_failed",
        errorType: "Error",
      });
      warn.mockRestore();
    });

    it("handles concurrent cron jobs without conflicts", async () => {
      const cleanup1 = performCleanup(asDb(mockDb));
      const cleanup2 = performCleanup(asDb(mockDb));

      await expect(Promise.all([cleanup1, cleanup2])).resolves.not.toThrow();
    });
  });

  describe("cron timing", () => {
    it("includes timestamp in results", async () => {
      const result = await performCleanup(asDb(mockDb));

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });
});
