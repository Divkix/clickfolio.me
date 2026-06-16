/**
 * Unit tests for retryPendingR2Deletions (lib/cron/cleanup-r2.ts).
 *
 * Focus: successful row removal, attempts-increment on failure, and
 * max-attempts skip path.
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { retryPendingR2Deletions } from "@/lib/cron/cleanup-r2";
import type { PendingR2Deletion } from "@/lib/db/schema";

type Row = PendingR2Deletion;

function createDb(rows: Row[]) {
  const whereDeleteCaptures: unknown[] = [];
  const updateSetCaptures: unknown[] = [];

  const deleteChain = {
    where: vi.fn((cond: unknown) => {
      whereDeleteCaptures.push(cond);
      return Promise.resolve(undefined);
    }),
  };

  const updateWhereChain = {
    where: vi.fn((cond: unknown) => {
      updateSetCaptures.push(cond);
      return Promise.resolve(undefined);
    }),
  };

  const updateSetChain = {
    set: vi.fn(() => updateWhereChain),
  };

  const selectChain = {
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
  };

  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    update: vi.fn().mockReturnValue(updateSetChain),
    _whereDeleteCaptures: whereDeleteCaptures,
    _updateSetCaptures: updateSetCaptures,
    _updateSetChain: updateSetChain,
  };

  return db;
}

function createBinding(deleteImpl?: () => Promise<void>) {
  return {
    delete: vi.fn(deleteImpl ?? (() => Promise.resolve(undefined))),
  };
}

function run(db: unknown, binding: unknown) {
  return retryPendingR2Deletions(db as never, binding as unknown as R2Bucket);
}

const baseRow: Row = {
  id: "pending-1",
  r2Key: "users/user-1/resume.pdf",
  createdAt: "2026-06-10T00:00:00.000Z",
  attempts: 1,
  lastError: null,
};

describe("retryPendingR2Deletions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a pending row when the R2 delete succeeds", async () => {
    const db = createDb([baseRow]);
    const binding = createBinding();

    const result = await run(db, binding);

    expect(result.ok).toBe(true);
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    expect(binding.delete).toHaveBeenCalledWith("users/user-1/resume.pdf");
    expect(db.delete).toHaveBeenCalled();
  });

  it("increments attempts and records lastError when R2 delete fails", async () => {
    const db = createDb([baseRow]);
    const binding = createBinding(() => Promise.reject(new Error("R2 unavailable")));

    const result = await run(db, binding);

    expect(result.ok).toBe(true);
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);

    expect(db.update).toHaveBeenCalled();
    const rawSetCalls = db._updateSetChain.set.mock.calls as unknown[][];
    const setArg = rawSetCalls[0]?.[0] as {
      attempts: number;
      lastError: string;
    };
    expect(setArg.attempts).toBe(2);
    expect(setArg.lastError).toBe("R2 unavailable");
  });

  it("skips rows that have reached max attempts (10) without touching R2 or DB", async () => {
    const maxedRow: Row = { ...baseRow, attempts: 10 };
    const db = createDb([maxedRow]);
    const binding = createBinding();

    const result = await run(db, binding);

    expect(result.retried).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);

    expect(binding.delete).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns zero counts and a timestamp when there are no pending rows", async () => {
    const db = createDb([]);
    const binding = createBinding();

    const result = await run(db, binding);

    expect(result.retried).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.timestamp).toBeTruthy();
    expect(binding.delete).not.toHaveBeenCalled();
  });

  it("handles a mix of successful, failing, and max-attempts rows", async () => {
    const rows: Row[] = [
      { ...baseRow, id: "ok-1", r2Key: "users/u1/a.pdf", attempts: 1 },
      { ...baseRow, id: "fail-1", r2Key: "users/u2/b.pdf", attempts: 2 },
      { ...baseRow, id: "max-1", r2Key: "users/u3/c.pdf", attempts: 10 },
    ];
    const db = createDb(rows);
    const binding: { delete: ReturnType<typeof vi.fn> } = {
      delete: vi
        .fn()
        .mockResolvedValueOnce(undefined) // ok-1 succeeds
        .mockRejectedValueOnce(new Error("timeout")), // fail-1 fails
    };

    const result = await run(db, binding);

    expect(result.retried).toBe(3);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
