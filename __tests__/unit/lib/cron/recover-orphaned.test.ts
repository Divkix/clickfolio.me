import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import { WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import type { ResumeParseMessage } from "@/lib/queue/types";
import type { Database } from "@/lib/db";

type Row = UnknownRecord;

/** Drizzle SQL AST node: object nodes carry column metadata; primitive leaves are inert. */
type SqlNode = {
  name?: string;
  columnType?: string;
  queryChunks?: JsonValue;
  chunks?: JsonValue;
  left?: JsonValue;
  right?: JsonValue;
  value?: JsonValue;
  expr?: JsonValue;
};

function isSqlNode(value: JsonValue): value is SqlNode {
  return value instanceof Object;
}

function collectColumns(node: JsonValue, depth = 0, acc = new Set<string>()): Set<string> {
  if (node == null || depth > 16) return acc;

  if (Array.isArray(node)) {
    for (const n of node) collectColumns(n, depth + 1, acc);

    return acc;
  }

  if (isSqlNode(node)) {
    if (node.name !== undefined && node.columnType !== undefined) {
      acc.add(node.name);
    }

    if (node.queryChunks) collectColumns(node.queryChunks, depth + 1, acc);

    for (const k of ["chunks", "left", "right", "value", "expr"] as const) {
      if (node[k]) collectColumns(node[k], depth + 1, acc);
    }
  }

  return acc;
}

function selectChain(rows: Row[], whereCaptures: JsonValue[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation((cond: JsonValue) => {
        whereCaptures.push(cond);

        return { limit: vi.fn().mockResolvedValue(rows) };
      }),
    }),
  };
}

function createMocks(options: { changes?: number } = {}) {
  const changes = options.changes ?? 1;
  const whereCaptures: JsonValue[] = [];
  const updateWhereCaptures: JsonValue[] = [];
  const setCalls: Row[] = [];

  const db = {
    select: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((arg: Row) => {
        setCalls.push(arg);

        return {
          where: vi.fn().mockImplementation((cond: JsonValue) => {
            updateWhereCaptures.push(cond);

            return Promise.resolve({ count: changes });
          }),
        };
      }),
    }),
  };

  const queue = {
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn().mockResolvedValue(undefined),
    metrics: vi.fn().mockResolvedValue(undefined),
  };

  const setBuckets = (pending: Row[], processing: Row[], queued: Row[], waiting: Row[] = []) => {
    db.select
      .mockReturnValueOnce(selectChain(pending, whereCaptures))
      .mockReturnValueOnce(selectChain(processing, whereCaptures))
      .mockReturnValueOnce(selectChain(queued, whereCaptures))
      .mockReturnValueOnce(selectChain(waiting, whereCaptures));
  };

  return { db, queue, whereCaptures, updateWhereCaptures, setCalls, setBuckets };
}

function run(db: Pick<Database, "select" | "update">, queue: Queue<ResumeParseMessage>) {
  // SAFETY: recoverOrphanedResumes only issues .select()/.update() — the exact surface the
  // stub implements — while its signature demands the full PostgresJs Database, which also
  // requires the live postgres-js $client no test can construct.
  return recoverOrphanedResumes(db as Database, queue);
}

describe("recoverOrphanedResumes — queued orphan recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recovers a stale queued resume and re-publishes it", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();

    const queuedOrphan = {
      id: "resume-queued",
      userId: "user-1",
      r2Key: "uploads/queued.pdf",
      fileHash: "hash-queued",
      totalAttempts: 1,
    } satisfies Row;

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
    expect(setCalls.some((c) => c.status === "queued")).toBe(true);
  });

  it("age-gates the processing query on queuedAt (with createdAt fallback)", async () => {
    const { db, queue, whereCaptures, setBuckets } = createMocks();
    setBuckets([], [], []);

    await run(db, queue);

    expect(whereCaptures).toHaveLength(4);
    const processingCols = collectColumns(whereCaptures[1]);
    expect(processingCols.has("queued_at")).toBe(true);
    expect(processingCols.has("created_at")).toBe(true);

    const queuedCols = collectColumns(whereCaptures[2]);
    expect(queuedCols.has("queued_at")).toBe(true);

    const pendingCols = collectColumns(whereCaptures[0]);
    expect(pendingCols.has("created_at")).toBe(true);
    expect(pendingCols.has("queued_at")).toBe(false);

    const waitingCols = collectColumns(whereCaptures[3]);
    expect(waitingCols.has("created_at")).toBe(true);
    expect(waitingCols.has("status")).toBe(true);
  });

  it("rolls a resume back to pending_claim when publish fails", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks();

    const queuedOrphan = {
      id: "resume-fail",
      userId: "user-2",
      r2Key: "uploads/fail.pdf",
      fileHash: "hash-fail",
      totalAttempts: 0,
    } satisfies Row;

    setBuckets([], [], [queuedOrphan]);
    queue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

    const result = await run(db, queue);

    expect(result.recovered).toBe(0);
    expect(result.found).toBe(1);
    const rollback = setCalls.find((c) => c.status === "pending_claim");
    expect(rollback).toBeDefined();
    expect(rollback?.queuedAt).toBeNull();
  });

  it("marks queued resumes past the attempt cap as failed instead of leaving them stuck", async () => {
    const { db, queue, setCalls, updateWhereCaptures, setBuckets } = createMocks();

    const maxedOut = {
      id: "resume-maxed",
      userId: "user-3",
      r2Key: "uploads/maxed.pdf",
      fileHash: "hash-maxed",
      totalAttempts: 6,
    } satisfies Row;

    setBuckets([], [], [maxedOut]);

    const result = await run(db, queue);

    expect(result.ok).toBe(true);
    expect(result.found).toBe(1);
    expect(result.recovered).toBe(1);
    expect(queue.send).not.toHaveBeenCalled();
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toMatchObject({
      status: "failed",
      errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
    });
    // Compare-and-set on the originally-selected row, so a row re-queued since
    // selection is left alone.
    const casCols = collectColumns(updateWhereCaptures[0]);
    expect(casCols.has("id")).toBe(true);
    expect(casCols.has("status")).toBe(true);
    expect(casCols.has("queued_at")).toBe(true);
  });

  it("skips publishing when the re-queue UPDATE affects 0 rows (TOCTOU)", async () => {
    const { db, queue, setCalls, setBuckets } = createMocks({ changes: 0 });

    const queuedOrphan = {
      id: "resume-race",
      userId: "user-1",
      r2Key: "uploads/race.pdf",
      fileHash: "hash-race",
      totalAttempts: 1,
    } satisfies Row;

    setBuckets([], [], [queuedOrphan]);

    const result = await run(db, queue);

    expect(result.ok).toBe(true);
    expect(result.recovered).toBe(0);
    expect(result.found).toBe(1);
    expect(setCalls.some((c) => c.status === "queued")).toBe(true);
    expect(queue.send).not.toHaveBeenCalled();
  });

  it("guards the re-queue UPDATE and the rollback on the originally-selected status", async () => {
    const { db, queue, updateWhereCaptures, setBuckets } = createMocks();

    const queuedOrphan = {
      id: "resume-race2",
      userId: "user-1",
      r2Key: "uploads/race2.pdf",
      fileHash: "hash-race2",
      totalAttempts: 1,
    } satisfies Row;

    setBuckets([], [], [queuedOrphan]);
    queue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

    const result = await run(db, queue);

    expect(result.recovered).toBe(0);
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

    const queuedOrphan = {
      id: "resume-noinc",
      userId: "user-1",
      r2Key: "uploads/noinc.pdf",
      fileHash: "hash-noinc",
      totalAttempts: 3,
    } satisfies Row;

    setBuckets([], [], [queuedOrphan]);

    const result = await run(db, queue);

    expect(result.recovered).toBe(1);
    expect(queue.send).toHaveBeenCalledTimes(1);
    const requeue = setCalls.find((c) => c.status === "queued");
    expect(requeue).toBeDefined();
    expect(requeue).not.toHaveProperty("totalAttempts");
  });
});
