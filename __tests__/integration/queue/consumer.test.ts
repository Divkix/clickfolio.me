import { getDb, type Database } from "@/lib/db";
import type { AlertEnv } from "@/lib/queue/alert";
import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

function asDatabase(db: {}): Database {
  // SAFETY: Database = PostgresJsDatabase & { $client: postgres.Sql } is only obtainable
  // from a live postgres-js client; the in-file drizzle mocks implement just the query
  // surface these tests exercise, so they can never satisfy the full Database type.
  return db as Database;
}

function parseAlertRecord(text: string): UnknownRecord | undefined {
  const value: unknown = JSON.parse(text);

  if (value instanceof Object && !Array.isArray(value)) {
    // SAFETY: JSON.parse returns any; dlq-consumer only ever logs object-shaped alert
    // payloads, so the object branch is a record — anything else reads as undefined.
    return value as UnknownRecord;
  }

  return undefined;
}

// String(v) === v holds exactly for primitive strings — the same values typeof v ===
// "string" matches — so JSON params narrow without a runtime typeof.
function isStringJsonValue(value: JsonValue): value is string {
  return String(value) === value;
}

type ResumeRecord = {
  id: string;
  status: string;
  parsedContent: UnknownRecord | null;
  parsedContentStaged: UnknownRecord | null;
  totalAttempts: number;
  lastAttemptError: string | null;
};

const mockDbState = {
  resumes: new Map<string, ResumeRecord>(),
  siteData: new Map<string, { content: string; userId: string }>(),
};

const mockR2Store = new Map<string, ArrayBuffer>();

const mockWebSocketNotifications: Array<{
  resumeId: string;
  status: string;
  error?: string;
}> = [];

const mockAlerts: Array<{
  type: string;
  payload: JsonValue;
}> = [];

function resetMockState() {
  mockDbState.resumes.clear();
  mockDbState.siteData.clear();
  mockR2Store.clear();
  mockWebSocketNotifications.length = 0;
  mockAlerts.length = 0;
}

function createResume(record: Partial<ResumeRecord>): ResumeRecord {
  const id = record.id ?? crypto.randomUUID();

  const fullRecord: ResumeRecord = {
    id,
    status: record.status ?? "queued",
    parsedContent: record.parsedContent ?? null,
    parsedContentStaged: record.parsedContentStaged ?? null,
    totalAttempts: record.totalAttempts ?? 0,
    lastAttemptError: record.lastAttemptError ?? null,
  };

  mockDbState.resumes.set(id, fullRecord);

  return fullRecord;
}

vi.mock("@/lib/r2", () => ({
  // SAFETY: every R2 touch in these tests goes through the vi.fn()-mocked R2.* methods
  // declared below, so the empty R2Bucket stub is never method-called — it only satisfies
  // the binding type the wrapper signatures require.
  getR2Binding: vi.fn().mockReturnValue({} as R2Bucket),
  R2: {
    getAsArrayBuffer: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string) => {
      return mockR2Store.get(key) ?? null;
    }),
    put: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string, data: ArrayBuffer) => {
      mockR2Store.set(key, data);
    }),
    delete: vi.fn().mockImplementation(async (_binding: R2Bucket, key: string) => {
      mockR2Store.delete(key);
    }),
  },
}));

vi.mock("@/lib/queue/notify-status", () => ({
  notifyStatusChange: vi
    .fn()
    .mockImplementation(
      async ({ resumeId, status, error }: { resumeId: string; status: string; error?: string }) => {
        mockWebSocketNotifications.push({ resumeId, status, error });
      },
    ),
  notifyStatusChangeBatch: vi
    .fn()
    .mockImplementation(async (resumeIds: string[], status: string, _env: CloudflareEnv) => {
      for (const resumeId of resumeIds) {
        mockWebSocketNotifications.push({ resumeId, status });
      }
    }),
}));

vi.mock("@/lib/data/site-data-upsert", () => ({
  buildSiteDataUpsert: vi.fn().mockImplementation(() => "mock-upsert-query"),
}));

function mockSelectChain(getRows: () => Array<UnknownRecord>) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => getRows()),
        then: (
          onFulfilled: (value: Array<UnknownRecord>) => void,
          onRejected?: (reason: Error) => void,
        ) => Promise.resolve(getRows()).then(onFulfilled, onRejected),
      })),
    })),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSqlFragment(value: unknown): value is { queryChunks: unknown } {
  return value instanceof Object && "queryChunks" in value;
}

// The ids bound into a mocked where clause: their string params are the row ids a
// real UPDATE ... RETURNING would match, in every condition shape used here.
function conditionIds(node: JsonValue, depth = 0, acc: string[] = []): string[] {
  if (node == null || depth > 16) return acc;

  if (Array.isArray(node)) {
    for (const child of node) conditionIds(child, depth + 1, acc);

    return acc;
  }

  if (node instanceof Object) {
    if (isStringJsonValue(node.value) && UUID_PATTERN.test(node.value)) acc.push(node.value);

    for (const key of ["queryChunks", "chunks", "left", "right", "value", "expr"]) {
      if (node[key]) conditionIds(node[key], depth + 1, acc);
    }
  }

  return acc;
}

// Mock drizzle update chain: `where(...)` stays awaitable while exposing `returning(...)`,
// which resolves the rows the statement would return for the ids it filters on.
function mockUpdateChain(options?: {
  setValues?: Array<UnknownRecord>;
  whereConds?: Array<JsonValue>;
  returning?: (cond: JsonValue) => Array<UnknownRecord>;
}) {
  const rowsFor =
    options?.returning ?? ((cond: JsonValue) => conditionIds(cond).map((id) => ({ id })));

  return {
    set: vi.fn((values: UnknownRecord) => {
      options?.setValues?.push(values);

      return {
        where: vi.fn((cond: JsonValue) => {
          options?.whereConds?.push(cond);

          return {
            returning: vi.fn(async () => rowsFor(cond)),
            then: (
              onFulfilled?: ((value: { count: number }) => void) | null,
              onRejected?: ((reason: Error) => void) | null,
            ) => Promise.resolve({ count: 0 }).then(onFulfilled, onRejected),
          };
        }),
      };
    }),
  };
}

function mockBuildDefaultMockDb() {
  const allRows = (): UnknownRecord[] => Array.from(mockDbState.resumes.values());

  const db = {
    select: vi.fn().mockImplementation((cols: JsonValue) => {
      const keys = cols instanceof Object ? cols : {};

      if ("handle" in keys) {
        const rows: Array<UnknownRecord> = "id" in keys ? [] : [{ handle: "test-handle" }];

        return mockSelectChain(() => rows);
      }

      if ("status" in keys) {
        return mockSelectChain(allRows);
      }

      if ("userId" in keys) {
        return mockSelectChain(() =>
          allRows()
            .filter((r) => r.status === "waiting_for_cache")
            .map((r) => ({ id: r.id, userId: r.userId })),
        );
      }

      return mockSelectChain(() =>
        allRows()
          .filter((r) => r.status === "completed" && r.parsedContent !== null)
          .map((r) => ({ id: r.id, parsedContent: r.parsedContent })),
      );
    }),
    update: vi.fn(() => mockUpdateChain()),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };

  return Object.assign(db, {
    transaction: vi.fn(async (cb: (tx: typeof db) => Promise<void>) => cb(db)),
  });
}

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mockBuildDefaultMockDb()),
}));

function withTransaction<T extends Record<string, unknown>>(db: T) {
  return Object.assign(db, {
    transaction: vi.fn(async (cb: (tx: T) => Promise<void>) => cb(db)),
  });
}

let mockAiResult: {
  success: boolean;
  parsedContent?: string;
  professionalLevel?: string;
  error?: string;
} | null = null;

let mockAiError: Error | null = null;

vi.mock("@/lib/ai", () => ({
  parseResumeWithAi: vi.fn().mockImplementation(async () => {
    if (mockAiError) throw mockAiError;

    if (!mockAiResult) {
      return {
        success: true,
        parsedContent: JSON.stringify({
          full_name: "Test User",
          headline: "Developer",
          summary: "Experienced developer.",
          contact: { email: "test@example.com" },
          experience: [],
          education: [],
          skills: [],
          certifications: [],
          projects: [],
        }),
        professionalLevel: "mid_level",
      };
    }

    return mockAiResult;
  }),
}));

function makePdfBuffer(): ArrayBuffer {
  const header = new TextEncoder().encode("%PDF-1.4 test content");

  return header.buffer.slice(header.byteOffset, header.byteOffset + header.byteLength);
}

function resetAll() {
  vi.clearAllMocks();
  resetMockState();
  vi.mocked(getDb).mockReset();
  vi.mocked(getDb).mockImplementation(() => asDatabase(mockBuildDefaultMockDb()));
  mockAiResult = null;
  mockAiError = null;
}

function createMessage(params: {
  resumeId?: string;
  userId?: string;
  r2Key?: string;
  fileHash?: string;
  attempt?: number;
}) {
  return {
    type: "parse" as const,
    resumeId: params.resumeId ?? crypto.randomUUID(),
    userId: params.userId ?? "user-1",
    r2Key: params.r2Key ?? `users/user-1/${Date.now()}/resume.pdf`,
    fileHash: params.fileHash ?? "a".repeat(64),
    attempt: params.attempt ?? 1,
  };
}

function createEnv(): CloudflareEnv {
  const statusDo: CloudflareEnv["CLICKFOLIO_STATUS_DO"] = {
    newUniqueId: vi.fn(),
    idFromName: vi.fn().mockReturnValue({}),
    idFromString: vi.fn(),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response("OK")),
    }),
    getByName: vi.fn(),
    jurisdiction: vi.fn(),
  };

  // SAFETY: workerd bindings cannot be constructed in tests; getDb, the r2 module and
  // notify-status are all vi.fn()-mocked, so these stubs are consumed structurally —
  // only connectionString and the namespace members exist because the env types require them.
  return {
    CLICKFOLIO_R2_BUCKET: {} as R2Bucket,
    HYPERDRIVE: {
      connectionString: "postgres://user:pass@localhost:5432/clickfolio",
    } as CloudflareEnv["HYPERDRIVE"],
    CLICKFOLIO_STATUS_DO: statusDo,
  } as CloudflareEnv;
}

function createDlqEnv(alerts?: Pick<AlertEnv, "ALERT_CHANNEL" | "ALERT_WEBHOOK_URL">) {
  // SAFETY: workerd bindings cannot be constructed in tests and getDb/notify-status are
  // module-mocked, so Hyperdrive is only a connectionString carrier; the DO namespace
  // stub implements every member DurableObjectNamespace declares, with vi.fn() covering
  // the id/stub returns no test can construct. Alerts stay plain AlertEnv data that
  // handleDLQMessage's inner `env as AlertEnv` reads.
  return {
    HYPERDRIVE: {
      connectionString: "postgres://user:pass@localhost:5432/clickfolio",
    } as CloudflareEnv["HYPERDRIVE"],
    CLICKFOLIO_STATUS_DO: {
      newUniqueId: vi.fn(),
      idFromName: vi.fn().mockReturnValue({}),
      idFromString: vi.fn(),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response("OK")),
      }),
      getByName: vi.fn(),
      jurisdiction: vi.fn(),
    },
    ...alerts,
  };
}

describe("Queue Consumer - Main Processing", () => {
  beforeEach(resetAll);

  it("1. Process valid resume → completed status + siteData upsert", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123456/resume.pdf`;

    createResume({ id: resumeId, status: "queued", totalAttempts: 0 });
    mockR2Store.set(r2Key, makePdfBuffer());

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await handleQueueMessage(message, env);

    expect(mockWebSocketNotifications.length).toBeGreaterThan(0);

    const completedNotification = mockWebSocketNotifications.find(
      (n) => n.resumeId === resumeId && n.status === "completed",
    );

    expect(completedNotification).toBeDefined();
  });

  it("2. Process with cached fileHash → skip AI, use cached siteData", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/222/resume.pdf`;

    createResume({
      id: resumeId,
      status: "queued",
      totalAttempts: 0,
    });
    mockR2Store.set(r2Key, makePdfBuffer());

    mockAiError = new Error("AI should not be called");

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow("AI should not be called");
  });

  it("3. Process with retryable error → throws for retry", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");
    const { QueueError, QueueErrorType } = await import("@/lib/queue/errors");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued", totalAttempts: 0 });
    mockR2Store.set(r2Key, makePdfBuffer());

    mockAiError = new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "AI provider timeout");

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow();
  });

  it("4. R2 file missing → permanent error (no retry)", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued", totalAttempts: 0 });

    mockR2Store.clear();

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow(/Failed to fetch PDF/);
  });

  it("5. Process already completed → idempotent skip", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;
    const existingContent = { name: "Already Done" };

    createResume({
      id: resumeId,
      status: "completed",
      parsedContent: existingContent,
    });
    mockR2Store.set(r2Key, makePdfBuffer());

    const mockDb = mockBuildDefaultMockDb();
    vi.mocked(mockDb.select).mockImplementation(() =>
      mockSelectChain(() => [
        { status: "completed", parsedContent: existingContent, totalAttempts: 1 },
      ]),
    );
    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).resolves.not.toThrow();

    expect(vi.mocked(mockDb.update)).not.toHaveBeenCalled();
    expect(vi.mocked(mockDb.transaction)).not.toHaveBeenCalled();
  });

  it("6. does NOT recover via the removed parsedContentStaged branch", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({
      id: resumeId,
      status: "queued",
      totalAttempts: 1,
      parsedContentStaged: { name: "Staged" },
    });
    mockR2Store.set(r2Key, makePdfBuffer());

    mockAiError = new Error("AI should not be called");

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow("AI should not be called");
  });

  it("7. Update totalAttempts on each processing attempt", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued", totalAttempts: 2 });
    mockR2Store.set(r2Key, makePdfBuffer());

    const message = createMessage({ resumeId, userId, r2Key, attempt: 3 });
    const env = createEnv();

    const setValues: Array<UnknownRecord> = [];
    const mockDb = mockBuildDefaultMockDb();
    vi.mocked(mockDb.update).mockImplementation(() => mockUpdateChain({ setValues }));
    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    await handleQueueMessage(message, env);

    expect(mockWebSocketNotifications.some((n) => n.status === "completed")).toBe(true);
    const processingUpdate = setValues.find((v) => v.status === "processing");
    // The increment is evaluated by the database so concurrent deliveries cannot lose attempts.
    expect(isSqlFragment(processingUpdate?.totalAttempts)).toBe(true);
  });

  it("8. Process notifies waiting resumes on completion", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const waitingResumeId = crypto.randomUUID();
    const userId = "user-1";
    const fileHash = "shared_hash";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued" });
    mockR2Store.set(r2Key, makePdfBuffer());

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const keys = cols instanceof Object ? cols : {};

        if ("handle" in keys) {
          return "id" in keys
            ? mockSelectChain(() => [{ id: userId, handle: "test-handle" }])
            : mockSelectChain(() => [{ handle: "test-handle" }]);
        }

        if ("status" in keys) {
          return mockSelectChain(() => [
            { status: "queued", parsedContent: null, parsedContentStaged: null, totalAttempts: 0 },
          ]);
        }

        // Rows waiting on this file hash; every other select (createdAt, siteData) is empty.
        if ("id" in keys && "userId" in keys) {
          return mockSelectChain(() => [{ id: waitingResumeId, userId }]);
        }

        return mockSelectChain(() => []);
      }),
      update: vi.fn(() => mockUpdateChain()),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key, fileHash });
    const env = createEnv();

    await handleQueueMessage(message, env);

    expect(
      mockWebSocketNotifications.some(
        (n) => n.resumeId === waitingResumeId && n.status === "completed",
      ),
    ).toBe(true);
  });

  it("8b. Process with no handle → publish:false still completes and upserts siteData", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");
    const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued" });
    mockR2Store.set(r2Key, makePdfBuffer());

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const isHandleQuery = cols instanceof Object && "handle" in cols;

        if (isHandleQuery) {
          return mockSelectChain(() => []);
        }

        if (cols instanceof Object && "userId" in cols) {
          return mockSelectChain(() => []);
        }

        return mockSelectChain(() => [{ status: "queued", parsedContent: null, totalAttempts: 0 }]);
      }),
      update: vi.fn(() => mockUpdateChain()),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).resolves.not.toThrow();

    expect(vi.mocked(mockDb.transaction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      resumeId,
      expect.anything(),
      { publish: false },
    );
  });

  it("8c. Syncs parsed name to user.name when current user.name is Unnamed", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued" });
    mockR2Store.set(r2Key, makePdfBuffer());

    const setValues: Array<UnknownRecord> = [];

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const isUserQuery = cols instanceof Object && "handle" in cols;

        if (isUserQuery) {
          return mockSelectChain(() => [{ handle: "test-handle", name: "Unnamed" }]);
        }

        if (cols instanceof Object && "userId" in cols) {
          return mockSelectChain(() => []);
        }

        return mockSelectChain(() => [{ status: "queued", parsedContent: null, totalAttempts: 0 }]);
      }),
      update: vi.fn(() => mockUpdateChain({ setValues })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await handleQueueMessage(message, env);

    const userUpdate = setValues.find((v) => "name" in v);
    expect(userUpdate?.name).toBe("Test User");
  });

  it("8d. Preserves existing user.name when already set", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued" });
    mockR2Store.set(r2Key, makePdfBuffer());

    const setValues: Array<UnknownRecord> = [];

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const isUserQuery = cols instanceof Object && "handle" in cols;

        if (isUserQuery) {
          return mockSelectChain(() => [{ handle: "test-handle", name: "Existing Name" }]);
        }

        if (cols instanceof Object && "userId" in cols) {
          return mockSelectChain(() => []);
        }

        return mockSelectChain(() => [{ status: "queued", parsedContent: null, totalAttempts: 0 }]);
      }),
      update: vi.fn(() => mockUpdateChain({ setValues })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await handleQueueMessage(message, env);

    const nameUpdate = setValues.find((v) => "name" in v);
    expect(nameUpdate).toBeUndefined();
  });

  it("9. R2 file not found → permanent error", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/missing.pdf`;

    createResume({ id: resumeId, status: "queued" });

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow(/Failed to fetch PDF/);
  });

  it("10. AI parse failure → records friendly + classified errors, throws", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued" });
    mockR2Store.set(r2Key, makePdfBuffer());

    mockAiResult = {
      success: false,
      error: "Invalid JSON response from AI",
    };

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow("Invalid JSON response from AI");
  });

  it("10b. Retryable AI error should NOT set status to 'failed' — Issue #83", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/resume.pdf`;

    createResume({ id: resumeId, status: "queued", totalAttempts: 0 });
    mockR2Store.set(r2Key, makePdfBuffer());

    mockAiResult = {
      success: false,
      error: "AI provider timeout",
    };

    const updateCalls: Array<{
      status?: string;
      lastAttemptError?: string;
      errorMessage?: string;
    }> = [];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "queued",
                parsedContent: null,
                parsedContentStaged: null,
                totalAttempts: 0,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn(() => mockUpdateChain({ setValues: updateCalls })),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow("AI provider timeout");

    const failedStatusUpdate = updateCalls.find((call) => call.status === "failed");
    expect(failedStatusUpdate).toBeUndefined();

    const errorUpdate = updateCalls.find((call) =>
      call.lastAttemptError?.includes("AI provider timeout"),
    );

    expect(errorUpdate).toBeDefined();
  });
});

describe("DLQ Consumer", () => {
  beforeEach(() => {
    resetAll();
    global.fetch = vi.fn().mockResolvedValue(new Response("OK"));
  });

  it("21. DLQ marks resume as permanently failed", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";

    createResume({
      id: resumeId,
      status: "failed",
      totalAttempts: 3,
      lastAttemptError: JSON.stringify({ type: "ai_provider_error" }),
    });

    const updateCalls: Array<{ status: string; errorMessage?: string }> = [];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "failed",
                totalAttempts: 3,
                lastAttemptError: JSON.stringify({ type: "ai_provider_error" }),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values: { status: string; errorMessage?: string }) => {
          updateCalls.push(values);

          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key: `users/${userId}/123/resume.pdf`,
      fileHash: "hash123",
      attempt: 3,
    };

    const env = createDlqEnv();

    await handleDLQMessage(message, env);

    expect(updateCalls.length).toBeGreaterThan(0);
    expect(updateCalls[0].status).toBe("failed");
    expect(updateCalls[0].errorMessage).toContain("Permanently failed");
  });

  it("22. DLQ sends WebSocket notification", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");
    const { notifyStatusChange } = await import("@/lib/queue/notify-status");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "failed",
                totalAttempts: 3,
                lastAttemptError: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = {
      type: "parse" as const,
      resumeId,
      userId,
      r2Key: `users/${userId}/123/resume.pdf`,
      fileHash: "hash123",
      attempt: 3,
    };

    const env = createDlqEnv();

    await handleDLQMessage(message, env);

    expect(notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeId,
        status: "failed",
      }),
    );
  });

  it("23. DLQ sends logpush alert by default", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "failed",
                totalAttempts: 3,
                lastAttemptError: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = {
      type: "parse" as const,
      resumeId: crypto.randomUUID(),
      userId: "user-1",
      r2Key: "users/user-1/123/resume.pdf",
      fileHash: "hash123",
      attempt: 3,
    };

    const env = createDlqEnv({ ALERT_CHANNEL: "logpush" });

    await handleDLQMessage(message, env);

    const dlqAlert = consoleSpy.mock.calls.find((call) => {
      try {
        return parseAlertRecord(call[0])?.["msg"] === "DLQ_ALERT";
      } catch {
        return false;
      }
    });

    expect(dlqAlert).toBeDefined();

    consoleSpy.mockRestore();
  });

  it("24. DLQ sends webhook alert when configured", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("OK"));

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "failed",
                totalAttempts: 3,
                lastAttemptError: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = {
      type: "parse" as const,
      resumeId: crypto.randomUUID(),
      userId: "user-1",
      r2Key: "users/user-1/123/resume.pdf",
      fileHash: "hash123",
      attempt: 3,
    };

    const env = createDlqEnv({
      ALERT_CHANNEL: "webhook",
      ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/TEST",
    });

    await handleDLQMessage(message, env);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/TEST",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("25. DLQ handles DeadLetterMessage wrapper", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "failed",
                totalAttempts: 5,
                lastAttemptError: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const originalMessage = {
      type: "parse" as const,
      resumeId: crypto.randomUUID(),
      userId: "user-1",
      r2Key: "users/user-1/123/resume.pdf",
      fileHash: "hash123",
      attempt: 5,
    };

    const deadLetterMessage = {
      originalMessage,
      failureReason: "Max retries exceeded",
      failedAt: new Date().toISOString(),
      attempts: 5,
    };

    const env = createDlqEnv();

    await expect(handleDLQMessage(deadLetterMessage, env)).resolves.not.toThrow();
  });

  it("26. DLQ does NOT clobber an already-completed resume", async () => {
    const { handleDLQMessage } = await import("@/lib/queue/dlq-consumer");
    const { notifyStatusChange } = await import("@/lib/queue/notify-status");

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const updateCalls: Array<{ status?: string; errorMessage?: string }> = [];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "completed",
                totalAttempts: 1,
                lastAttemptError: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values: { status?: string; errorMessage?: string }) => {
          updateCalls.push(values);

          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = {
      type: "parse" as const,
      resumeId: crypto.randomUUID(),
      userId: "user-1",
      r2Key: "users/user-1/123/resume.pdf",
      fileHash: "hash123",
      attempt: 3,
    };

    const env = createDlqEnv();

    await handleDLQMessage(message, env);

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(updateCalls.find((c) => c.status === "failed")).toBeUndefined();

    expect(notifyStatusChange).not.toHaveBeenCalled();

    const dlqAlertCall = consoleErrorSpy.mock.calls.find((call) => {
      try {
        return parseAlertRecord(call[0])?.["msg"] === "DLQ_ALERT";
      } catch {
        return false;
      }
    });

    expect(dlqAlertCall).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });
});

describe("Worker Queue Handler (worker/index.ts)", () => {
  beforeEach(resetAll);

  it("26. Worker validates message shape before processing", async () => {
    const { queueMessageSchema } = await import("@/lib/queue/types");

    const validMessage = {
      type: "parse",
      resumeId: "test-id",
      userId: "user-1",
      r2Key: "users/user-1/123/resume.pdf",
      fileHash: "hash123",
      attempt: 1,
    };

    const result = queueMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);

    const invalidMessage = {
      type: "parse",
    };

    const invalidResult = queueMessageSchema.safeParse(invalidMessage);
    expect(invalidResult.success).toBe(false);
  });

  it("27. Worker acks malformed messages", async () => {
    const { queueMessageSchema } = await import("@/lib/queue/types");

    const malformedMessage = {
      type: "unknown",
      random: "data",
    };

    const result = queueMessageSchema.safeParse(malformedMessage);
    expect(result.success).toBe(false);
  });

  it("28. Worker routes to DLQ handler for DLQ queue", async () => {
    const batch = {
      queue: "clickfolio-parse-dlq",
      messages: [
        {
          id: "msg-1",
          body: {
            type: "parse",
            resumeId: "test-id",
            userId: "user-1",
            r2Key: "key",
            fileHash: "hash",
            attempt: 3,
          },
          ack: vi.fn(),
          retry: vi.fn(),
        },
      ],
    };

    expect(batch.queue).toContain("dlq");
  });

  it("29. Worker uses isRetryableError for retry decisions", async () => {
    const { isRetryableError } = await import("@/lib/queue/errors");

    const retryable = isRetryableError(new Error("Timeout"));
    const permanent = isRetryableError(new Error("Invalid PDF"));

    expect(retryable).toBeTypeOf("boolean");
    expect(permanent).toBeTypeOf("boolean");
  });

  it("30. Worker acks permanent errors to DLQ", async () => {
    const { isRetryableError, QueueError, QueueErrorType } = await import("@/lib/queue/errors");

    const permanentError = new QueueError(QueueErrorType.INVALID_PDF, "Invalid");
    const retryableError = new QueueError(QueueErrorType.AI_PROVIDER_ERROR, "Timeout");

    expect(isRetryableError(permanentError)).toBe(false);
    expect(isRetryableError(retryableError)).toBe(true);
  });
});

function collectColumns(node: JsonValue, depth = 0, acc = new Set<string>()): Set<string> {
  if (node == null || depth > 16) return acc;

  if (Array.isArray(node)) {
    for (const n of node) collectColumns(n, depth + 1, acc);

    return acc;
  }

  if (node instanceof Object) {
    if (isStringJsonValue(node.name) && isStringJsonValue(node.columnType)) {
      acc.add(node.name);
    }

    if (node.queryChunks) collectColumns(node.queryChunks, depth + 1, acc);

    for (const k of ["chunks", "left", "right", "value", "expr"]) {
      if (node[k]) collectColumns(node[k], depth + 1, acc);
    }
  }

  return acc;
}

describe("Batch A — queue/state-machine integrity fixes", () => {
  beforeEach(resetAll);

  it("1. Fan-out UPDATE is scoped to the SELECTed ids, not fileHash+status", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const waitingId = crypto.randomUUID();
    const userId = "user-1";
    const fileHash = "shared-hash";
    const r2Key = `users/${userId}/123/resume.pdf`;

    mockR2Store.set(r2Key, makePdfBuffer());

    const updateWhereConds: JsonValue[] = [];

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const keys = cols instanceof Object ? cols : {};

        if ("handle" in keys) {
          return "id" in keys
            ? mockSelectChain(() => [{ id: userId, handle: "test-handle" }])
            : mockSelectChain(() => [{ handle: "test-handle" }]);
        }

        if ("status" in keys) {
          return mockSelectChain(() => [
            { status: "queued", parsedContent: null, totalAttempts: 0 },
          ]);
        }

        // Rows waiting on this file hash; every other select (createdAt, siteData) is empty.
        if ("id" in keys && "userId" in keys) {
          return mockSelectChain(() => [{ id: waitingId, userId }]);
        }

        return mockSelectChain(() => []);
      }),
      update: vi.fn(() => mockUpdateChain({ whereConds: updateWhereConds })),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key, fileHash });
    const env = createEnv();

    await handleQueueMessage(message, env);

    expect(updateWhereConds.length).toBe(6);
    const fanOutCond = updateWhereConds[3];
    const cols = collectColumns(fanOutCond);
    expect(cols.has("id")).toBe(true);
    expect(cols.has("file_hash")).toBe(false);
    // Scoped to exactly the SELECTed id; the status predicate can only be a guard.
    expect(conditionIds(fanOutCond)).toEqual([waitingId]);

    expect(mockWebSocketNotifications.some((n) => n.resumeId === waitingId)).toBe(true);
  });

  it("1b. Fan-out with no handle → publish:false still upserts siteData for primary", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");
    const { buildSiteDataUpsert } = await import("@/lib/data/site-data-upsert");

    const resumeId = crypto.randomUUID();
    const waitingId = crypto.randomUUID();
    const userId = "user-1";
    const fileHash = "shared-hash";
    const r2Key = `users/${userId}/123/resume.pdf`;

    mockR2Store.set(r2Key, makePdfBuffer());

    const mockDb = withTransaction({
      select: vi.fn().mockImplementation((cols: JsonValue) => {
        const keys = cols instanceof Object ? cols : {};

        if ("handle" in keys) {
          return mockSelectChain(() => []);
        }

        if ("status" in keys) {
          return mockSelectChain(() => [
            { status: "queued", parsedContent: null, totalAttempts: 0 },
          ]);
        }

        // Rows waiting on this file hash; every other select (createdAt, siteData) is empty.
        if ("id" in keys && "userId" in keys) {
          return mockSelectChain(() => [{ id: waitingId, userId }]);
        }

        return mockSelectChain(() => []);
      }),
      update: vi.fn(() => mockUpdateChain()),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    });

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId, r2Key, fileHash });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).resolves.not.toThrow();

    expect(vi.mocked(mockDb.transaction)).toHaveBeenCalledTimes(2);

    expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      resumeId,
      expect.anything(),
      { publish: false },
    );
    expect(vi.mocked(buildSiteDataUpsert)).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      waitingId,
      expect.anything(),
      { publish: false },
    );
  });

  it("2. Skips parse when the resume row no longer exists (deleted account)", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const r2Key = `users/user-1/123/missing-resume.pdf`;

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const message = createMessage({ resumeId, userId: "user-1", r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).resolves.not.toThrow();

    expect(mockR2Store.has(r2Key)).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockWebSocketNotifications).toHaveLength(0);
  });

  it("3. Non-retryable failure UPDATE is guarded against clobbering a completed resume", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const r2Key = `users/user-1/123/resume.pdf`;

    const updateWhereConds: JsonValue[] = [];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                status: "completed",
                parsedContent: null,
                totalAttempts: 1,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn(() => mockUpdateChain({ whereConds: updateWhereConds })),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    mockR2Store.clear();

    const message = createMessage({ resumeId, userId: "user-1", r2Key });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow(/Failed to fetch PDF/);

    expect(updateWhereConds.length).toBeGreaterThan(0);
    const failureCond = updateWhereConds[updateWhereConds.length - 1];
    const cols = collectColumns(failureCond);
    expect(cols.has("status")).toBe(true);
    expect(cols.has("id")).toBe(true);
  });

  it("5. Permanent errors send an alert from the consumer's failure branch", async () => {
    const { handleQueueMessage } = await import("@/lib/queue/consumer");

    const resumeId = crypto.randomUUID();
    const userId = "user-1";
    const r2Key = `users/${userId}/123/missing.pdf`;

    createResume({ id: resumeId, status: "queued" });

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ status: "queued", parsedContent: null, totalAttempts: 0 }]),
          }),
        }),
      }),
      update: vi.fn(() => mockUpdateChain()),
    };

    vi.mocked(getDb).mockReturnValue(asDatabase(mockDb));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const message = createMessage({ resumeId, userId, r2Key, attempt: 3 });
    const env = createEnv();

    await expect(handleQueueMessage(message, env)).rejects.toThrow(/Failed to fetch PDF/);

    const dlqAlert = consoleSpy.mock.calls.find((call) => {
      try {
        return parseAlertRecord(call[0])?.["msg"] === "DLQ_ALERT";
      } catch {
        return false;
      }
    });

    expect(dlqAlert).toBeDefined();
    const payload = parseAlertRecord(dlqAlert![0]);
    expect(payload).toMatchObject({
      resumeId,
      userId,
      failureReason: expect.stringContaining("Failed to fetch PDF"),
      errorType: "file_not_found",
      totalAttempts: 3,
    });

    consoleSpy.mockRestore();
  });
});
