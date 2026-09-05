import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

const mockLimitQueue: Array<Array<Record<string, JsonValue>>> = [];
const mockLimit = vi.fn(async () => mockLimitQueue.shift() ?? []);
const mockUpdateSets: Array<Record<string, JsonValue>> = [];
const mockUpdateWhere = vi.fn(async () => undefined);
const mockUpdateSet = vi.fn((values: Record<string, JsonValue>) => {
  mockUpdateSets.push(values);
  return { where: mockUpdateWhere };
});
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockTransactions: Array<unknown> = [];
const mockTransaction = vi.fn(async (cb: (tx: typeof mockDb) => unknown) => {
  mockTransactions.push(true);
  return cb(mockDb);
});

const mockDb = {
  select: vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: mockLimit,
        then: (onFulfilled: (value: Array<Record<string, JsonValue>>) => unknown) =>
          Promise.resolve(mockLimitQueue.shift() ?? []).then(onFulfilled),
      }),
    }),
  })),
  update: mockUpdate,
  transaction: mockTransaction,
};

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: JsonValue, val: JsonValue) => ({ eq: val })),
  inArray: vi.fn((col: JsonValue, values: JsonValue) => ({ inArray: { col, values } })),
}));

vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    parsedContent: "parsedContent",
    parsedContentStaged: "parsedContentStaged",
    lastAttemptError: "lastAttemptError",
    status: "status",
    parsedAt: "parsedAt",
    totalAttempts: "totalAttempts",
  },
  user: { id: "id", handle: "handle", name: "name", role: "role" },
}));

const mockUpsertCalls: Array<{ userId: string; publish: boolean }> = [];
const mockBuildSiteDataUpsert = vi.fn(
  (..._args: unknown[]) => "mock-upsert-query" as unknown as never,
);
vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: (
    _db: unknown,
    userId: string,
    _resumeId: string,
    _content: unknown,
    opts?: { publish?: boolean },
  ) => {
    mockUpsertCalls.push({ userId, publish: opts?.publish ?? true });
    return mockBuildSiteDataUpsert();
  },
}));

const mockNotifyBatches: Array<{ ids: string[]; status: string }> = [];
vi.mock("@/lib/queue/notify-status", () => ({
  notifyStatusChangeBatch: async (ids: string[], status: string, _env: unknown) => {
    mockNotifyBatches.push({ ids, status });
  },
}));

import { completeResumes, shouldSyncDisplayName } from "@/lib/resume/completion";

const parsedContent = {
  full_name: "Test User",
  professional_level: "senior",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockLimitQueue.length = 0;
  mockUpdateSets.length = 0;
  mockTransactions.length = 0;
  mockUpsertCalls.length = 0;
  mockNotifyBatches.length = 0;
  mockLimit.mockImplementation(async () => mockLimitQueue.shift() ?? []);
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockImplementation((values: Record<string, JsonValue>) => {
    mockUpdateSets.push(values);
    return { where: mockUpdateWhere };
  });
  mockUpdateWhere.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (cb: (tx: typeof mockDb) => unknown) => {
    mockTransactions.push(true);
    return cb(mockDb);
  });
});

describe("shouldSyncDisplayName", () => {
  it("syncs when current name is missing", () => {
    expect(shouldSyncDisplayName("Test User", null)).toBe(true);
    expect(shouldSyncDisplayName("Test User", "")).toBe(true);
    expect(shouldSyncDisplayName("Test User", "Unnamed")).toBe(true);
    expect(shouldSyncDisplayName("Test User", "   ")).toBe(true);
  });
  it("skips placeholder parsed names and existing names", () => {
    expect(shouldSyncDisplayName("Pending", null)).toBe(false);
    expect(shouldSyncDisplayName("Unnamed", null)).toBe(false);
    expect(shouldSyncDisplayName(null, null)).toBe(false);
    expect(shouldSyncDisplayName("Test User", "Existing Name")).toBe(false);
  });
});

describe("completeResumes", () => {
  it("fresh single → atomic batch, combined name+role update, notify", async () => {
    mockLimitQueue.push([{ handle: "test-handle", name: "Unnamed" }]);

    await completeResumes({
      db: mockDb as never,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [{ resumeId: "resume-1", userId: "user-1" }],
      parsedContent,
      professionalLevel: "senior",
    });

    expect(mockTransactions).toHaveLength(1);
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({
        status: "completed",
        parsedContentStaged: null,
        lastAttemptError: null,
      }),
    );
    expect(mockUpsertCalls).toEqual([{ userId: "user-1", publish: true }]);
    const userUpdates = mockUpdateSets.filter((s) => "role" in s || "name" in s);
    expect(userUpdates).toHaveLength(1);
    expect(userUpdates[0]).toMatchObject({
      name: "Test User",
      role: "senior",
      roleSource: "ai",
    });
    expect(mockNotifyBatches).toEqual([{ ids: ["resume-1"], status: "completed" }]);
  });

  it("cached single → sets totalAttempts and gains career-level sync", async () => {
    mockLimitQueue.push([{ handle: "test-handle", name: null }]);

    await completeResumes({
      db: mockDb as never,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [{ resumeId: "resume-1", userId: "user-1" }],
      parsedContent,
      professionalLevel: "senior",
      totalAttempts: 2,
    });

    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ status: "completed", totalAttempts: 2 }),
    );
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ role: "senior", name: "Test User" }),
    );
  });

  it("single with existing name and no level → no user update, still completes", async () => {
    mockLimitQueue.push([{ handle: null, name: "Existing Name" }]);

    await completeResumes({
      db: mockDb as never,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [{ resumeId: "resume-1", userId: "user-1" }],
      parsedContent,
    });

    expect(mockUpdateSets).toContainEqual(expect.objectContaining({ status: "completed" }));
    expect(mockUpsertCalls).toEqual([{ userId: "user-1", publish: false }]);
    expect(mockUpdateSets.filter((s) => "role" in s || "name" in s)).toHaveLength(0);
    expect(mockNotifyBatches).toEqual([{ ids: ["resume-1"], status: "completed" }]);
  });

  it("fan-out → one batch, per-user publish, split role/name sync, one notify", async () => {
    mockLimitQueue.push([
      { id: "user-1", handle: "h1", name: null },
      { id: "user-2", handle: null, name: "Existing Name" },
    ]);

    await completeResumes({
      db: mockDb as never,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [
        { resumeId: "resume-1", userId: "user-1" },
        { resumeId: "resume-2", userId: "user-2" },
      ],
      parsedContent,
      professionalLevel: "senior",
      fanOut: true,
    });

    expect(mockTransactions).toHaveLength(1);
    expect(mockUpsertCalls).toEqual([
      { userId: "user-1", publish: true },
      { userId: "user-2", publish: false },
    ]);
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ role: "senior", roleSource: "ai" }),
    );
    const nameUpdates = mockUpdateSets.filter((s) => "name" in s);
    expect(nameUpdates).toHaveLength(1);
    expect(mockNotifyBatches).toEqual([{ ids: ["resume-1", "resume-2"], status: "completed" }]);
  });
});
