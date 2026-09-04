import { vi, type Mock } from "vite-plus/test";
import type { Resume } from "@/lib/db/schema";

export function createMockQueryChain<T = unknown>(rows: T[] = []) {
  const chain: Record<string, Mock> = {};
  const handler: ProxyHandler<() => Promise<T[]>> = {
    get(_target, prop) {
      const strProp = String(prop);

      if (strProp === "then") {
        return (onFulfilled?: (value: T[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(rows).then(onFulfilled, onRejected);
      }
      if (strProp === "toJSON") {
        return () => rows;
      }

      if (!(strProp in chain)) {
        chain[strProp] = vi.fn().mockReturnValue(new Proxy(() => {}, handler));
      }
      return chain[strProp];
    },
    apply() {
      return Promise.resolve(rows);
    },
  };

  return new Proxy(() => {}, handler) as unknown as {
    [K in string]: Mock;
  } & Promise<T[]>;
}

export interface SqlClient extends Mock {
  prepare: Mock;
  sql: Mock;
  un: Mock;
}

export interface MockDb {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  transaction: Mock;
  $client: SqlClient;
}

export function createMockDb(): MockDb {
  const db = {
    select: vi.fn().mockReturnValue(createMockQueryChain()),
    insert: vi.fn().mockReturnValue(createMockQueryChain()),
    update: vi.fn().mockReturnValue(createMockQueryChain()),
    delete: vi.fn().mockReturnValue(createMockQueryChain()),
    $client: Object.assign(vi.fn().mockResolvedValue({ count: 1 }), {
      prepare: vi.fn(),
      sql: vi.fn(),
      un: vi.fn(),
    }),
  } as MockDb;
  db.transaction = vi.fn(async (cb: (tx: MockDb) => unknown) => cb(db));
  return db;
}

export function createMockDbResume(overrides: Partial<Resume> = {}): Resume {
  return {
    id: "resume-db-uuid-001",
    userId: "user-db-uuid-001",
    r2Key: "uploads/test/resume.pdf",
    status: "completed",
    errorMessage: null,
    parsedAt: "2026-01-15T12:05:00.000Z",
    retryCount: 0,
    fileHash: "sha256-abc123",
    parsedContent: null,
    queuedAt: null,
    parsedContentStaged: null,
    lastAttemptError: null,
    totalAttempts: 1,
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:05:00.000Z",
    ...overrides,
  };
}
