import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

const mockLimitQueue: Array<Array<Record<string, JsonValue>>> = [];

const mockLimit = vi.fn(async () => mockLimitQueue.shift() ?? []);

const mockUpdateSets: Array<Record<string, JsonValue>> = [];

// `.returning()` is the row probe behind every conditional UPDATE: a non-empty
// result means the row still existed, so the status change applied.
const mockUpdateReturning = vi.fn(async () => [{ id: "row-1" }]);

const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));

const mockUpdateSet = vi.fn((values: Record<string, JsonValue>) => {
  mockUpdateSets.push(values);

  return { where: mockUpdateWhere };
});

const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

let lastInsertValues: Record<string, JsonValue> = {};

// The arbitration insert reports the row it inserted unless a test forces the
// conflicting-row shape (a pending_claim claim already in flight).
let mockArbitrationRows: Array<{ id: string; status: string }> | null = null;

const mockInsertReturning = vi.fn(
  async () => mockArbitrationRows ?? [{ id: String(lastInsertValues.id), status: "pending_claim" }],
);

const mockInsertValues = vi.fn((values: Record<string, JsonValue>) => {
  lastInsertValues = values;

  return {
    onConflictDoUpdate: () => ({ returning: mockInsertReturning }),
    onConflictDoNothing: async () => undefined,
  };
});

const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockWhereChain = {
  limit: mockLimit,
  orderBy: () => ({ limit: mockLimit }),
  for: async () => undefined,
};

const mockSelect = vi.fn(() => ({ from: () => ({ where: () => mockWhereChain }) }));

const mockTransaction = vi.fn(async <R>(cb: (tx: typeof mockDb) => R) => cb(mockDb));

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  transaction: mockTransaction,
};

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: JsonValue, val: JsonValue) => ({ eq: val })),
  and: vi.fn((...args: JsonValue[]) => ({ and: args })),
  desc: vi.fn((col: JsonValue) => ({ desc: col })),
  gte: vi.fn((_col: JsonValue, val: JsonValue) => ({ gte: val })),
  ne: vi.fn((_col: JsonValue, val: JsonValue) => ({ ne: val })),
  isNotNull: vi.fn((col: JsonValue) => ({ isNotNull: col })),
  inArray: vi.fn((col: JsonValue, values: JsonValue) => ({ inArray: { col, values } })),
  sql: vi.fn((...args: JsonValue[]) => ({ sql: args })),
}));

vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    userId: "userId",
    r2Key: "r2Key",
    status: "status",
    errorMessage: "errorMessage",
    fileHash: "fileHash",
    parsedContent: "parsedContent",
    parsedAt: "parsedAt",
    queuedAt: "queuedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  user: { id: "id", handle: "handle", name: "name" },
}));

const mockBuildSiteDataUpsert = vi.fn((..._args: unknown[]) => "mock-upsert-query");

vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: (...args: unknown[]) => mockBuildSiteDataUpsert(...args),
}));

const mockEnforceRateLimit = vi.fn((..._args: unknown[]) => Promise.resolve(null));

vi.mock("@/lib/rate-limit/user", () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

import { runClaimIntake } from "@/lib/resume/claim-intake";

type FakeBucket = {
  files: Map<string, ArrayBuffer>;
  failPut: boolean;
  get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null>;
  put: (key: string, body: ArrayBuffer) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

function makeBucket(initial: Record<string, ArrayBuffer> = {}): FakeBucket {
  const files = new Map(Object.entries(initial));

  const bucket: FakeBucket = {
    files,
    failPut: false,
    get: async (key) => {
      const buf = files.get(key);

      if (!buf) return null;

      return { arrayBuffer: async () => buf };
    },
    put: async (key, body) => {
      if (bucket.failPut) throw new Error("R2 put failed");
      files.set(key, body);
    },
    delete: async (key) => {
      files.delete(key);
    },
  };

  return bucket;
}

type WorkflowCreate = { id: string; params: Record<string, JsonValue> };

type FakeWorkflow = {
  sent: Array<Record<string, JsonValue>>;
  ids: string[];
  create: (opts: WorkflowCreate) => Promise<{ id: string }>;
  get: (id: string) => Promise<{ id: string }>;
};

function makeWorkflow(failCreate = false): FakeWorkflow {
  const sent: Array<Record<string, JsonValue>> = [];
  const ids: string[] = [];

  return {
    sent,
    ids,
    create: async ({ id, params }) => {
      if (failCreate) throw new Error("workflow create failed");
      ids.push(id);
      sent.push(params);

      return { id };
    },
    get: async (id) => {
      if (!ids.includes(id)) throw new Error("instance not found");

      return { id };
    },
  };
}

type ClaimBinding = { db: never; r2: never; parseWorkflow: never };

// SAFETY: mockDb implements exactly the select/insert/update/transaction calls
// runClaimIntake drives, FakeBucket implements the R2 get/put/delete calls,
// and makeWorkflow implements create/get; lib observes these stand-ins only
// through never-typed binding fields at its I/O boundary.
const claimBinding = (r2: FakeBucket, parseWorkflow: FakeWorkflow | null) =>
  ({ db: mockDb, r2, parseWorkflow }) as ClaimBinding;

function makePdfBuffer(): ArrayBuffer {
  const bytes = new TextEncoder().encode("%PDF-1.4 fake content");

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const TEMP_KEY = "temp/uuid/resume.pdf";

const finalKey = (resumeId: string) => `users/user-1/${resumeId}/resume.pdf`;

beforeEach(() => {
  vi.clearAllMocks();
  mockLimitQueue.length = 0;
  mockUpdateSets.length = 0;
  mockArbitrationRows = null;
  lastInsertValues = {};
  mockLimit.mockImplementation(async () => mockLimitQueue.shift() ?? []);
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertReturning.mockImplementation(
    async () =>
      mockArbitrationRows ?? [{ id: String(lastInsertValues.id), status: "pending_claim" }],
  );
  mockUpdateReturning.mockResolvedValue([{ id: "row-1" }]);
  mockUpdateWhere.mockImplementation(() => ({ returning: mockUpdateReturning }));
  mockUpdateSet.mockImplementation((values: Record<string, JsonValue>) => {
    mockUpdateSets.push(values);

    return { where: mockUpdateWhere };
  });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockTransaction.mockImplementation(async <R>(cb: (tx: typeof mockDb) => R) => cb(mockDb));
  mockEnforceRateLimit.mockResolvedValue(null);
});

describe("runClaimIntake", () => {
  it("fresh upload → queued with a parse run and R2 move", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow();
    // Cached-content probe, then the in-flight probe: neither finds a rival row.
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome.kind).toBe("queued");

    if (outcome.kind !== "queued") throw new Error("expected queued");
    expect(outcome.resumeId).toBeTruthy();
    expect(workflow.sent).toHaveLength(1);
    expect(workflow.ids).toEqual([outcome.resumeId]);
    expect(workflow.sent[0]).toMatchObject({
      kind: "parse",
      resumeId: outcome.resumeId,
      userId: "user-1",
      r2Key: finalKey(outcome.resumeId),
    });
    expect(r2.files.has(TEMP_KEY)).toBe(false);
    expect(r2.files.has(finalKey(outcome.resumeId))).toBe(true);
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ status: "queued", r2Key: finalKey(outcome.resumeId) }),
    );
    expect(mockBuildSiteDataUpsert).not.toHaveBeenCalled();
  });

  it("cache-hit → completed without a parse run, syncing the display name only", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow();
    const cachedContent = { full_name: "Cached Name" };
    mockLimitQueue.push(
      [],
      [{ id: "cached-1", parsedContent: cachedContent }],
      [{ handle: "some-handle", name: null }],
    );

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "cached" });

    if (outcome.kind !== "cached") throw new Error("expected cached");
    expect(workflow.sent).toHaveLength(0);
    expect(r2.files.has(finalKey(outcome.resumeId))).toBe(true);
    expect(mockBuildSiteDataUpsert).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.anything(),
      cachedContent,
      expect.objectContaining({ publish: true }),
    );
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "completed" }));
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ name: "Cached Name" }));
    expect(mockUpdateSets.filter((update) => "role" in update)).toHaveLength(0);
  });

  it("in-flight duplicate → waiting_for_cache with a timeout run, no parse", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow();
    // Cached probe, in-flight probe, post-move completed re-check, then the
    // self-row probe that confirms the row still exists.
    mockLimitQueue.push([], [], [{ id: "inflight-1" }], [], [{ id: "row-1" }]);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome.kind).toBe("waiting_for_cache");

    if (outcome.kind !== "waiting_for_cache") throw new Error("expected waiting_for_cache");
    expect(workflow.sent).toEqual([{ kind: "await-cache", resumeId: outcome.resumeId }]);
    expect(r2.files.has(finalKey(outcome.resumeId))).toBe(true);
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ status: "waiting_for_cache", r2Key: finalKey(outcome.resumeId) }),
    );
  });

  it("conflicting pending_claim row from arbitration → already_claimed without a parse run", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow();
    mockArbitrationRows = [{ id: "pending-1", status: "pending_claim" }];

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toEqual({
      kind: "already_claimed",
      resumeId: "pending-1",
      status: "pending_claim",
    });
    expect(workflow.sent).toHaveLength(0);
    // The rival claim owns the temp object: no status churn, no move.
    expect(mockUpdateSets).toHaveLength(0);
    expect(r2.files.has(TEMP_KEY)).toBe(true);
  });

  it("missing temp file whose row still names that key → already_claimed before rate-limit", async () => {
    const r2 = makeBucket();
    const workflow = makeWorkflow();
    mockLimitQueue.push([{ id: "recent-1", status: "queued" }]);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toEqual({
      kind: "already_claimed",
      resumeId: "recent-1",
      status: "queued",
    });
    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("R2 write failure on fresh path → error and failed row", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    r2.failPut = true;
    const workflow = makeWorkflow();
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 500 });
    expect(workflow.sent).toHaveLength(0);
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("R2 write failure on cached path → error instead of falling through", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    r2.failPut = true;
    const workflow = makeWorkflow();
    mockLimitQueue.push([], [{ id: "cached-1", parsedContent: { full_name: "Cached" } }]);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 500 });
    expect(mockBuildSiteDataUpsert).not.toHaveBeenCalled();
    expect(workflow.sent).toHaveLength(0);
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("workflow start failure → failed row that stays manually retryable", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow(true);
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({
      kind: "error",
      message: "Failed to start resume processing",
      httpStatus: 500,
    });
    // No instance exists under the resume's id, so nothing will parse it.
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ status: "failed", errorMessage: expect.any(String) }),
    );
    expect(mockUpdateSets).not.toContainEqual(
      expect.objectContaining({ lastAttemptError: expect.anything() }),
    );
  });

  it("missing workflow binding → error and failed row", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, null),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({
      kind: "error",
      message: "Failed to start resume processing",
      httpStatus: 500,
    });
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("missing temp file with no row on that key → not already_claimed", async () => {
    const r2 = makeBucket();
    const workflow = makeWorkflow();

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 404 });
    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
  });

  it("pending duplicate is already_claimed before the rate limit", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const workflow = makeWorkflow();
    mockLimitQueue.push([{ id: "pending-existing", status: "pending_claim" }]);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toEqual({
      kind: "already_claimed",
      resumeId: "pending-existing",
      status: "pending_claim",
    });
    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("waiting path put failure does not point the row at the final key", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    r2.failPut = true;
    const workflow = makeWorkflow();
    mockLimitQueue.push([], [], [{ id: "inflight-1" }]);

    const outcome = await runClaimIntake({
      ...claimBinding(r2, workflow),
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 500 });
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
    expect(mockUpdateSets).not.toContainEqual(
      expect.objectContaining({ status: "waiting_for_cache" }),
    );
    expect(r2.files.has(TEMP_KEY)).toBe(true);
  });
});
