import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";
import type { ResumeContent } from "@/lib/types/database";

// Awaited SELECTs (`.limit(1)` or bare) and `.returning()` results are served in
// call order from queues: user row → createdAt snapshot → site_data, then the ids
// the guarded UPDATE matched.
const mockSelectQueue: Array<Array<Record<string, JsonValue>>> = [];

const mockReturningQueue: Array<Array<Record<string, JsonValue>>> = [];

const mockLimit = vi.fn(async () => mockSelectQueue.shift() ?? []);

const mockSelectWhere = vi.fn(() => ({
  limit: mockLimit,
  then: <TResult>(
    onFulfilled: (value: Array<Record<string, JsonValue>>) => TResult | PromiseLike<TResult>,
  ) => Promise.resolve(mockSelectQueue.shift() ?? []).then(onFulfilled),
}));

const mockUpdateSets: Array<Record<string, JsonValue>> = [];

const mockUpdateWhere = vi.fn(() => ({
  returning: async () => mockReturningQueue.shift() ?? [],
  then: <TResult>(onFulfilled: (value: undefined) => TResult | PromiseLike<TResult>) =>
    Promise.resolve(undefined).then(onFulfilled),
}));

const mockUpdateSet = vi.fn((values: Record<string, JsonValue>) => {
  mockUpdateSets.push(values);

  return { where: mockUpdateWhere };
});

const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockTransactions: Array<unknown> = [];

const mockTransaction = vi.fn(async <R>(cb: (tx: typeof mockDb) => R) => {
  mockTransactions.push(true);

  return cb(mockDb);
});

const mockDb = {
  select: vi.fn(() => ({ from: () => ({ where: mockSelectWhere }) })),
  update: mockUpdate,
  transaction: mockTransaction,
};

type DbBinding = { db: never };

// SAFETY: mockDb implements the select/update/transaction surface
// completeResumes drives; lib reads it only through the never-typed db field
// at its I/O boundary.
const dbArg = { db: mockDb } as DbBinding;

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: JsonValue, val: JsonValue) => ({ eq: val })),
  ne: vi.fn((col: JsonValue, val: JsonValue) => ({ ne: { col, val } })),
  inArray: vi.fn((col: JsonValue, values: JsonValue) => ({ inArray: { col, values } })),
  and: vi.fn((...conditions: JsonValue[]) => ({ and: conditions })),
}));

vi.mock("@/lib/db/schema", () => ({
  resumes: {
    id: "id",
    createdAt: "createdAt",
    parsedContent: "parsedContent",
    parsedContentStaged: "parsedContentStaged",
    lastAttemptError: "lastAttemptError",
    status: "status",
    parsedAt: "parsedAt",
    totalAttempts: "totalAttempts",
  },
  siteData: { userId: "userId", updatedAt: "updatedAt" },
  user: { id: "id", handle: "handle", name: "name", role: "role" },
}));

const mockUpsertCalls: Array<{ userId: string; publish: boolean }> = [];

const mockBuildSiteDataUpsert = vi.fn((..._args: unknown[]) => "mock-upsert-query");

vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: (
    _db: typeof mockDb,
    userId: string,
    _resumeId: string,
    _content: ResumeContent,
    opts?: { publish?: boolean },
  ) => {
    mockUpsertCalls.push({ userId, publish: opts?.publish ?? true });

    return mockBuildSiteDataUpsert();
  },
}));

const mockNotifyBatches: Array<{ ids: string[]; status: string }> = [];

vi.mock("@/lib/queue/notify-status", () => ({
  notifyStatusChangeBatch: async (
    ids: string[],
    status: string,
    _env: { CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined },
  ) => {
    mockNotifyBatches.push({ ids, status });
  },
}));

import { completeResumes, shouldSyncDisplayName } from "@/lib/resume/completion";

const parsedContent: ResumeContent = {
  full_name: "Test User",
  headline: "Test headline",
  summary: "Test summary",
  contact: { email: "" },
  experience: [],
  professional_level: "senior",
};

const resumeCreatedAt = "2024-01-01T00:00:00.000Z";

// DB responses in call order: user rows → createdAt snapshot → site_data rows, and
// the ids the guarded UPDATE reports as written (defaults to every requested id).
function seedCompletion(options: {
  userRows: Array<Record<string, JsonValue>>;
  resumeIds: string[];
  siteRows?: Array<Record<string, JsonValue>>;
  updatedIds?: string[];
}) {
  mockSelectQueue.push(
    options.userRows,
    options.resumeIds.map((id) => ({ id, createdAt: resumeCreatedAt })),
    options.siteRows ?? [],
  );
  mockReturningQueue.push((options.updatedIds ?? options.resumeIds).map((id) => ({ id })));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectQueue.length = 0;
  mockReturningQueue.length = 0;
  mockUpdateSets.length = 0;
  mockTransactions.length = 0;
  mockUpsertCalls.length = 0;
  mockNotifyBatches.length = 0;
  mockLimit.mockImplementation(async () => mockSelectQueue.shift() ?? []);
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockImplementation((values: Record<string, JsonValue>) => {
    mockUpdateSets.push(values);

    return { where: mockUpdateWhere };
  });
  mockTransaction.mockImplementation(async <R>(cb: (tx: typeof mockDb) => R) => {
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
    seedCompletion({
      userRows: [{ handle: "test-handle", name: "Unnamed" }],
      resumeIds: ["resume-1"],
    });

    await completeResumes({
      ...dbArg,
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
    seedCompletion({ userRows: [{ handle: "test-handle", name: null }], resumeIds: ["resume-1"] });

    await completeResumes({
      ...dbArg,
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
    seedCompletion({
      userRows: [{ handle: null, name: "Existing Name" }],
      resumeIds: ["resume-1"],
    });

    await completeResumes({
      ...dbArg,
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
    seedCompletion({
      userRows: [
        { id: "user-1", handle: "h1", name: null },
        { id: "user-2", handle: null, name: "Existing Name" },
      ],
      resumeIds: ["resume-1", "resume-2"],
    });

    await completeResumes({
      ...dbArg,
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

  it("fan-out role and name sync only the rows the update matched", async () => {
    seedCompletion({
      userRows: [
        { id: "user-1", handle: "h1", name: null },
        { id: "user-2", handle: null, name: "Existing Name" },
      ],
      resumeIds: ["resume-1", "resume-2"],
      updatedIds: ["resume-2"],
    });

    await completeResumes({
      ...dbArg,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [
        { resumeId: "resume-1", userId: "user-1" },
        { resumeId: "resume-2", userId: "user-2" },
      ],
      parsedContent,
      professionalLevel: "senior",
      fanOut: true,
    });

    expect(mockUpsertCalls).toEqual([{ userId: "user-2", publish: false }]);
    const nameUpdates = mockUpdateSets.filter((s) => "name" in s);
    expect(nameUpdates).toHaveLength(0);
    expect(mockNotifyBatches).toEqual([{ ids: ["resume-2"], status: "completed" }]);
  });

  it("no rows updated (already completed or deleted) → no user sync, no notify, no writes", async () => {
    seedCompletion({
      userRows: [{ handle: "test-handle", name: "Unnamed" }],
      resumeIds: ["resume-1"],
      updatedIds: [],
    });

    await completeResumes({
      ...dbArg,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [{ resumeId: "resume-1", userId: "user-1" }],
      parsedContent,
      professionalLevel: "senior",
    });

    expect(mockTransactions).toHaveLength(1);
    expect(mockUpdateSets).toContainEqual(
      expect.objectContaining({ status: "completed", parsedContentStaged: null }),
    );
    // The site_data SELECT never ran: only the user row and the createdAt snapshot were read.
    expect(mockSelectQueue).toHaveLength(1);
    expect(mockUpsertCalls).toEqual([]);
    expect(mockUpdateSets.filter((s) => "role" in s || "name" in s)).toHaveLength(0);
    expect(mockNotifyBatches).toEqual([]);
  });

  it("skips the site-data write when a manual edit is newer than the resume", async () => {
    seedCompletion({
      userRows: [{ handle: "test-handle", name: "Unnamed" }],
      resumeIds: ["resume-1"],
      siteRows: [{ userId: "user-1", updatedAt: "2024-06-01T00:00:00.000Z" }],
    });

    await completeResumes({
      ...dbArg,
      env: { CLICKFOLIO_STATUS_DO: undefined },
      items: [{ resumeId: "resume-1", userId: "user-1" }],
      parsedContent,
      professionalLevel: "senior",
    });

    expect(mockUpsertCalls).toEqual([]);
    expect(mockNotifyBatches).toEqual([{ ids: ["resume-1"], status: "completed" }]);
    // The site_data row was read and the newer updatedAt is what suppressed the write.
    expect(mockSelectQueue).toEqual([]);
  });
});
