/**
 * Unit tests for orphaned resume recovery (lib/cron/recover-orphaned.ts).
 *
 * Focus: the queued-orphan scan, queuedAt age-gating on the processing query,
 * publish-failure rollback, and max-attempts skipping.
 *
 * The mocked `db` does not evaluate SQL WHERE clauses, so age-gating behavior is
 * verified by introspecting the drizzle condition passed to `.where()` (asserting
 * which columns it references) rather than by row filtering.
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import type { ResumeParseMessage } from "@/lib/queue/types";

type Row = Record<string, unknown>;

/** Recursively collect drizzle column names referenced inside a SQL condition. */
function collectColumns(node: unknown, depth = 0, acc = new Set<string>()): Set<string> {
  if (node == null || depth > 16) return acc;
  if (Array.isArray(node)) {
    for (const n of node) collectColumns(n, depth + 1, acc);
    return acc;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.name === "string" && typeof obj.columnType === "string") {
      acc.add(obj.name);
    }
    if (obj.queryChunks) collectColumns(obj.queryChunks, depth + 1, acc);
    for (const k of ["chunks", "left", "right", "value", "expr"]) {
      if (obj[k]) collectColumns(obj[k], depth + 1, acc);
    }
  }
  return acc;
}

function selectChain(rows: Row[], whereCaptures: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation((cond: unknown) => {
        whereCaptures.push(cond);
        return { limit: vi.fn().mockResolvedValue(rows) };
      }),
    }),
  };
}

function createMocks(options: { changes?: number } = {}) {
  const changes = options.changes ?? 1;
  const whereCaptures: unknown[] = [];
  const updateWhereCaptures: unknown[] = [];
  const setCalls: Row[] = [];

  const db = {
    select: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((arg: Row) => {
        setCalls.push(arg);
        return {
          where: vi.fn().mockImplementation((cond: unknown) => {
            updateWhereCaptures.push(cond);
            return Promise.resolve({ meta: { changes } });
          }),
        };
      }),
    }),
  };

  const queue = { send: vi.fn().mockResolvedValue(undefined) };

  /** Configure the three parallel selects in order: pending_claim, processing, queued. */
  const setBuckets = (pending: Row[], processing: Row[], queued: Row[]) => {
    db.select
      .mockReturnValueOnce(selectChain(pending, whereCaptures))
      .mockReturnValueOnce(selectChain(processing, whereCaptures))
      .mockReturnValueOnce(selectChain(queued, whereCaptures));
  };

  return { db, queue, whereCaptures, updateWhereCaptures, setCalls, setBuckets };
}

function run(db: unknown, queue: unknown) {
  return recoverOrphanedResumes(db as never, queue as unknown as Queue<ResumeParseMessage>);
}

describe("recoverOrphanedResumes — queued orphan recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recovers a stale queued resume and re-publishes it", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();
    const queuedOrphan: Row = {
      id: "resume-queued",
      userId: "user-1",
      r2Key: "uploads/queued.pdf",
      fileHash: "hash-queued",
      totalAttempts: 1,
    };
    setBuckets([], [], [queuedOrphan]);

    const result = await run(db, queue);

    expect(result.ok).toBe(true);
    expect(result.found).toBe(1);
    expect(result.recovered).toBe(1);
    expect(queue.send).toHaveBeenCalledTimes(1);
    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "parse",
        resumeId: "resume-queued",
        userId: "user-1",
      }),
    );
    // Pre-publish status write set it back to "queued".
    expect(setCalls.some((c) => c.status === "queued")).toBe(true);
  });

  it("age-gates the processing query on queuedAt (with createdAt fallback)", async () => {
    const { db, queue, whereCaptures, setBuckets } = createMocks();
    setBuckets([], [], []);

    await run(db, queue);

    // whereCaptures order matches select order: [pending_claim, processing, queued]
    expect(whereCaptures).toHaveLength(3);
    const processingCols = collectColumns(whereCaptures[1]);
    expect(processingCols.has("queued_at")).toBe(true);
    // createdAt remains only as the null-fallback branch.
    expect(processingCols.has("created_at")).toBe(true);

    const queuedCols = collectColumns(whereCaptures[2]);
    expect(queuedCols.has("queued_at")).toBe(true);

    // The pending_claim query still age-gates on created_at only.
    const pendingCols = collectColumns(whereCaptures[0]);
    expect(pendingCols.has("created_at")).toBe(true);
    expect(pendingCols.has("queued_at")).toBe(false);
  });

  it("rolls a resume back to pending_claim when publish fails", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();
    const queuedOrphan: Row = {
      id: "resume-fail",
      userId: "user-2",
      r2Key: "uploads/fail.pdf",
      fileHash: "hash-fail",
      totalAttempts: 0,
    };
    setBuckets([], [], [queuedOrphan]);
    queue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

    const result = await run(db, queue);

    expect(result.recovered).toBe(0);
    expect(result.found).toBe(1);
    const rollback = setCalls.find((c) => c.status === "pending_claim");
    expect(rollback).toBeDefined();
    expect(rollback?.queuedAt).toBeNull();
  });

  it("skips queued resumes that have exceeded max attempts", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();
    const maxedOut: Row = {
      id: "resume-maxed",
      userId: "user-3",
      r2Key: "uploads/maxed.pdf",
      fileHash: "hash-maxed",
      totalAttempts: 6,
    };
    setBuckets([], [], [maxedOut]);

    const result = await run(db, queue);

    expect(result.recovered).toBe(0);
    expect(queue.send).not.toHaveBeenCalled();
    // Skipped before any DB write — no status change attempted.
    expect(setCalls).toHaveLength(0);
  });

  it("skips publishing when the re-queue UPDATE affects 0 rows (TOCTOU)", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks({ changes: 0 });
    const queuedOrphan: Row = {
      id: "resume-race",
      userId: "user-1",
      r2Key: "uploads/race.pdf",
      fileHash: "hash-race",
      totalAttempts: 1,
    };
    setBuckets([], [], [queuedOrphan]);

    const result = await run(db, queue);

    expect(result.ok).toBe(true);
    expect(result.recovered).toBe(0);
    expect(result.found).toBe(1);
    // The re-queue SET was attempted but 0 rows matched — the row moved on
    // (consumer / manual retry / earlier recovery pass), so no publish.
    expect(setCalls.some((c) => c.status === "queued")).toBe(true);
    expect(queue.send).not.toHaveBeenCalled();
  });

  it("guards the re-queue UPDATE and the rollback on the originally-selected status", async () => {
    const { db, queue, updateWhereCaptures, setBuckets } = createMocks();
    const queuedOrphan: Row = {
      id: "resume-race2",
      userId: "user-1",
      r2Key: "uploads/race2.pdf",
      fileHash: "hash-race2",
      totalAttempts: 1,
    };
    setBuckets([], [], [queuedOrphan]);
    queue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

    const result = await run(db, queue);

    expect(result.recovered).toBe(0);
    // updateWhereCaptures order: [requeue guard, rollback guard].
    expect(updateWhereCaptures).toHaveLength(2);
    const requeueCols = collectColumns(updateWhereCaptures[0]);
    expect(requeueCols.has("status")).toBe(true);
    expect(requeueCols.has("id")).toBe(true);
    const rollbackCols = collectColumns(updateWhereCaptures[1]);
    expect(rollbackCols.has("status")).toBe(true);
    expect(rollbackCols.has("id")).toBe(true);
  });

  it("does not increment totalAttempts during recovery (consumer counts actual attempts)", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();
    const queuedOrphan: Row = {
      id: "resume-noinc",
      userId: "user-1",
      r2Key: "uploads/noinc.pdf",
      fileHash: "hash-noinc",
      totalAttempts: 3,
    };
    setBuckets([], [], [queuedOrphan]);

    const result = await run(db, queue);

    expect(result.recovered).toBe(1);
    expect(queue.send).toHaveBeenCalledTimes(1);
    const requeue = setCalls.find((c) => c.status === "queued");
    expect(requeue).toBeDefined();
    // Regression: the old code bumped totalAttempts here AND the queue consumer
    // bumps it again per actual attempt, double-counting every recovered resume.
    expect(requeue).not.toHaveProperty("totalAttempts");
  });
});
