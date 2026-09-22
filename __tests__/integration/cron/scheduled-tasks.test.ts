import type { Mock } from "vite-plus/test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { performCleanup } from "@/lib/cron/cleanup";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { R2 } from "@/lib/r2";

vi.mock("@/lib/r2", () => ({
  R2: { delete: vi.fn() },
}));

interface MockCronDb {
  transaction: Mock;
  select: Mock;
  update: Mock;
  insert: Mock;
  delete: Mock;
}

interface MockQueue {
  send: Mock;
  sendBatch: Mock;
  metrics: Mock;
}

/** Row shapes the mocked SELECT chains hand back across both cron queries. */
interface SelectedRow {
  id: string;
  userId?: string;
  status?: string;
  r2Key?: string | null;
  fileHash?: string;
  totalAttempts?: number;
  updatedAt?: string | null;
  createdAt?: string;
}

/** Fields asserted on in the mocked `update().set(...)` payload. */
interface UpdateValues {
  status?: string;
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

// DELETE ... RETURNING: `where(...)` stays awaitable (RowList.count) while exposing
// `returning(...)`, which yields the rows the delete actually removed.
function deleteChain(count: number, returned: Array<{ id: string; r2Key: string | null }> = []) {
  return {
    where: vi.fn(() => ({
      count,
      returning: vi.fn(async () => returned),
      then: (
        onFulfilled?: ((value: { count: number }) => { count: number }) | null,
        onRejected?: ((reason: Error) => { count: number }) | null,
      ) => Promise.resolve({ count }).then(onFulfilled, onRejected),
    })),
  };
}

function createMockDb(): MockCronDb {
  const db: MockCronDb = {
    transaction: vi.fn(async (cb: (tx: MockCronDb) => Promise<void>) => cb(db)),
    select: vi.fn(() => selectChain([])),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({ count: 0 }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    })),
    delete: vi.fn(() => deleteChain(0)),
  };

  return db;
}

function createMockQueue(): MockQueue {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn().mockResolvedValue(undefined),
    metrics: vi.fn(),
  };
}

function asDb(db: MockCronDb): never {
  // SAFETY: MockCronDb stubs only the Drizzle methods these cron jobs call; the real drizzle
  // `Database` type also requires a live postgres-js `$client` no unit test can construct.
  return db as never;
}

// SAFETY: the exercised cleanup paths report R2 deletes through the mocked "@/lib/r2" module and
// never call a method on this parameter, so a bare object satisfies it.
const R2_BUCKET_STUB = {} as R2Bucket;

describe("Cron Scheduled Tasks", () => {
  let mockDb: MockCronDb;
  let mockQueue: MockQueue;

  beforeEach(() => {
    mockDb = createMockDb();
    mockQueue = createMockQueue();
    vi.clearAllMocks();
  });

  describe("performCleanup", () => {
    it("deletes rate limits and handle changes in ONE transaction using RowList.count", async () => {
      mockDb.delete
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue({ count: 5 }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue({ count: 10 }),
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

    it("purges failed resumes past TTL, deferring failed R2 deletes", async () => {
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
      vi.mocked(R2.delete).mockRejectedValueOnce(new Error("R2 unavailable"));

      const result = await performCleanup(asDb(mockDb), R2_BUCKET_STUB);

      expect(result.ok).toBe(true);
      expect(result.deleted.failedResumes).toBe(1);
      expect(R2.delete).toHaveBeenCalledWith(expect.anything(), "uploads/failed.pdf");
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(3);
    });

    it("deletes R2 objects of purged failed resumes without fallback rows on success", async () => {
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
      vi.mocked(R2.delete).mockResolvedValueOnce(undefined);

      const result = await performCleanup(asDb(mockDb), R2_BUCKET_STUB);

      expect(result.deleted.failedResumes).toBe(1);
      expect(R2.delete).toHaveBeenCalledWith(expect.anything(), "uploads/failed.pdf");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("recoverOrphanedResumes", () => {
    const EMPTY_CHAIN = selectChain([]);

    function orphanChain(resume: SelectedRow) {
      return selectChain([resume]);
    }

    it("recovers orphaned resumes stuck in pending_claim", async () => {
      const orphanedResume = {
        id: "resume-123",
        userId: "user-456",
        status: "pending_claim",
        r2Key: "uploads/user-456/file.pdf",
        fileHash: "abc123",
        totalAttempts: 0,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ count: 1 }),
        })),
      });
      mockDb.select
        .mockReturnValueOnce(orphanChain(orphanedResume))
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN);

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.ok).toBe(true);
      expect(result.recovered).toBeGreaterThan(0);
      expect(mockQueue.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "parse",
          resumeId: orphanedResume.id,
          userId: orphanedResume.userId,
          r2Key: orphanedResume.r2Key,
          fileHash: orphanedResume.fileHash,
        }),
      );
    });

    it("recovers orphaned resumes stuck in processing status", async () => {
      const processingOrphan = {
        id: "resume-processing",
        userId: "user-789",
        status: "processing",
        r2Key: "uploads/user-789/file.pdf",
        fileHash: "def456",
        totalAttempts: 1,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ count: 1 }),
        })),
      });
      mockDb.select
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(orphanChain(processingOrphan))
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN);

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.ok).toBe(true);
      expect(result.recovered).toBe(1);
    });

    it("does not re-queue resumes at max attempts, marking them failed instead", async () => {
      const maxAttemptsResume = {
        id: "max-attempts",
        userId: "user-123",
        status: "processing",
        r2Key: "uploads/file.pdf",
        fileHash: "hash123",
        totalAttempts: 6,
      };

      const setValues: UpdateValues[] = [];
      mockDb.update.mockReturnValue({
        set: vi.fn((values: UpdateValues) => {
          setValues.push(values);

          return { where: vi.fn().mockResolvedValue({ count: 1 }) };
        }),
      });
      mockDb.select
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(orphanChain(maxAttemptsResume))
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN);

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.recovered).toBe(1);
      expect(setValues.find((values) => values.status === "failed")).toBeDefined();
      expect(mockQueue.send).not.toHaveBeenCalled();
    });

    it("does NOT re-queue when the row moved on since selection (TOCTOU guard)", async () => {
      const racedResume = {
        id: "raced-resume",
        userId: "user-456",
        status: "pending_claim",
        r2Key: "uploads/user-456/file.pdf",
        fileHash: "abc123",
        totalAttempts: 0,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ count: 0 }),
        })),
      });
      mockDb.select
        .mockReturnValueOnce(orphanChain(racedResume))
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN);

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.recovered).toBe(0);
      expect(mockQueue.send).not.toHaveBeenCalled();
    });

    it("transitions expired waiting_for_cache rows durably", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ count: 1 }),
        })),
      });
      mockDb.select
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(EMPTY_CHAIN)
        .mockReturnValueOnce(selectChain([{ id: "expired-waiting", status: "waiting_for_cache" }]));

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.ok).toBe(true);
      expect(result.recovered).toBe(1);
      expect(result.found).toBe(1);
      expect(mockQueue.send).not.toHaveBeenCalled();
    });

    it("handles no orphaned resumes found", async () => {
      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.ok).toBe(true);
      expect(result.recovered).toBe(0);
      expect(result.found).toBe(0);
      expect(mockQueue.send).not.toHaveBeenCalled();
    });
  });

  describe("cron execution logging", () => {
    it("logs cleanup execution without errors", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await performCleanup(asDb(mockDb));

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("error"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it("logs recovery execution without errors", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("error"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("propagates database errors during cleanup", async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error("Database connection failed"));

      await expect(performCleanup(asDb(mockDb))).rejects.toThrow("Database connection failed");
    });

    it("rolls back and reports zero recovered when queue publishing fails", async () => {
      const orphanedResume = {
        id: "orphan-123",
        userId: "user-456",
        status: "pending_claim",
        r2Key: "temp/file.pdf",
        fileHash: "hash789",
        totalAttempts: 0,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ count: 1 }),
        })),
      });
      mockDb.select
        .mockReturnValueOnce(selectChain([orphanedResume]))
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([]));
      mockQueue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

      const result = await recoverOrphanedResumes(asDb(mockDb), mockQueue);

      expect(result.recovered).toBe(0);
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

  describe("multiple cron jobs", () => {
    it("handles multiple job types concurrently", async () => {
      const [cleanupResult, recoveryResult] = await Promise.all([
        performCleanup(asDb(mockDb)),
        recoverOrphanedResumes(asDb(mockDb), mockQueue),
      ]);

      expect(cleanupResult.ok).toBe(true);
      expect(recoveryResult.ok).toBe(true);
    });
  });
});
