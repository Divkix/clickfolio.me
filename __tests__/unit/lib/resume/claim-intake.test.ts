import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

const mockLimitQueue: Array<Array<Record<string, JsonValue>>> = [];
const mockLimit = vi.fn(async () => mockLimitQueue.shift() ?? []);
const mockInsertValues = vi.fn(async () => undefined);
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSets: Array<Record<string, JsonValue>> = [];
const mockUpdateWhere = vi.fn(async () => undefined);
const mockUpdateSet = vi.fn((values: Record<string, JsonValue>) => {
  mockUpdateSets.push(values);
  return { where: mockUpdateWhere };
});
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockTransaction = vi.fn(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb));

const mockDb = {
  select: vi.fn(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({ limit: mockLimit }),
        limit: mockLimit,
      }),
    }),
  })),
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
    createdAt: "createdAt",
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

function makeQueue(failSend = false) {
  const sent: Array<Record<string, JsonValue>> = [];
  return {
    sent,
    send: async (msg: Record<string, JsonValue>) => {
      if (failSend) throw new Error("queue send failed");
      sent.push(msg);
    },
  };
}

function makePdfBuffer(): ArrayBuffer {
  const bytes = new TextEncoder().encode("%PDF-1.4 fake content");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const TEMP_KEY = "temp/uuid/resume.pdf";

beforeEach(() => {
  vi.clearAllMocks();
  mockLimitQueue.length = 0;
  mockUpdateSets.length = 0;
  mockLimit.mockImplementation(async () => mockLimitQueue.shift() ?? []);
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockResolvedValue(undefined);
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockImplementation((values: Record<string, JsonValue>) => {
    mockUpdateSets.push(values);
    return { where: mockUpdateWhere };
  });
  mockUpdateWhere.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  mockEnforceRateLimit.mockResolvedValue(null);
});

describe("runClaimIntake", () => {
  it("fresh upload → queued with enqueue and R2 move", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const queue = makeQueue();
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome.kind).toBe("queued");
    if (outcome.kind !== "queued") throw new Error("expected queued");
    expect(outcome.resumeId).toBeTruthy();
    expect(queue.sent).toHaveLength(1);
    expect(queue.sent[0]).toMatchObject({ userId: "user-1", attempt: 1 });
    expect(r2.files.has(TEMP_KEY)).toBe(false);
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "queued" }));
    expect(mockBuildSiteDataUpsert).not.toHaveBeenCalled();
  });

  it("cache-hit → completed without enqueue, syncing name and career level", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const queue = makeQueue();
    const cachedContent = { full_name: "Cached Name", professional_level: "senior" };
    mockLimitQueue.push(
      [{ id: "cached-1", parsedContent: cachedContent as JsonValue }],
      [{ handle: "some-handle", name: null }],
    );

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "cached" });
    expect(queue.sent).toHaveLength(0);
    expect(mockBuildSiteDataUpsert).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.anything(),
      cachedContent,
      { publish: true },
    );
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "completed" }));
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ name: "Cached Name", role: "senior", roleSource: "ai" }),
    );
  });

  it("in-flight duplicate → waiting_for_cache without enqueue", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const queue = makeQueue();
    mockLimitQueue.push([], [{ id: "inflight-1" }]);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome.kind).toBe("waiting_for_cache");
    expect(queue.sent).toHaveLength(0);
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "waiting_for_cache" }));
  });

  it("missing temp file with recent resume → already_claimed before rate-limit", async () => {
    const r2 = makeBucket();
    const queue = makeQueue();
    mockLimitQueue.push([{ id: "recent-1", status: "queued" }]);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
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
    const queue = makeQueue();
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 500 });
    expect(queue.sent).toHaveLength(0);
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("R2 write failure on cached path → error instead of falling through", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    r2.failPut = true;
    const queue = makeQueue();
    mockLimitQueue.push([{ id: "cached-1", parsedContent: { full_name: "Cached" } as JsonValue }]);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({ kind: "error", httpStatus: 500 });
    expect(mockBuildSiteDataUpsert).not.toHaveBeenCalled();
    expect(queue.sent).toHaveLength(0);
  });

  it("queue publish failure → error with rollback to pending_claim", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    const queue = makeQueue(true);
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: queue as never,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({
      kind: "error",
      message: "Failed to queue resume for processing",
      httpStatus: 500,
    });
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "queued" }));
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "pending_claim" }));
  });

  it("missing queue binding → error and failed row", async () => {
    const r2 = makeBucket({ [TEMP_KEY]: makePdfBuffer() });
    mockLimitQueue.push([], []);

    const outcome = await runClaimIntake({
      db: mockDb as never,
      r2: r2 as never,
      queue: null,
      env: undefined,
      userId: "user-1",
      tempKey: TEMP_KEY,
    });

    expect(outcome).toMatchObject({
      kind: "error",
      message: "Queue service unavailable",
      httpStatus: 500,
    });
    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });
});
