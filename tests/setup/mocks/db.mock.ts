import { vi, type Mock } from "vite-plus/test";
import type { Resume } from "@/lib/db/schema";

/** Chain a mocked Drizzle query resolves through: every method returns the chain, awaiting it yields the rows. */
export type MockQueryChain<T> = Record<string, Mock> & Promise<T[]>;

/** Callback shape both `$client.begin` and `transaction` hand their transaction handle to. */
type MockTransactionCallback<T> = (tx: T) => Promise<void>;

export function createMockQueryChain<T = unknown>(rows: T[] = []): MockQueryChain<T> {
  const chain: Record<string, Mock> = {};

  const handler: ProxyHandler<{}> = {
    get(_target, prop) {
      const strProp = String(prop);

      if (strProp === "then") {
        return <TResult>(onFulfilled?: (value: T[]) => TResult) =>
          Promise.resolve(rows).then(onFulfilled);
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

  const target: {} = () => {};

  // SAFETY: `target` is a function at runtime and the `get` trap synthesizes every queried method while
  // `apply` resolves the rows, so no static type describes the synthesized chain shape.
  return new Proxy(target, handler) as MockQueryChain<T>;
}

export interface SqlClient extends Mock {
  prepare: Mock;
  sql: Mock;
  un: Mock;
  begin: Mock;
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
  const raw = Object.assign(vi.fn().mockResolvedValue({ count: 1 }), {
    prepare: vi.fn(),
    sql: vi.fn(),
    un: vi.fn(),
    begin: vi.fn(),
  });

  raw.begin.mockImplementation(async (cb: MockTransactionCallback<SqlClient>): Promise<void> =>
    cb(raw),
  );

  const db: MockDb = {
    select: vi.fn().mockReturnValue(createMockQueryChain()),
    insert: vi.fn().mockReturnValue(createMockQueryChain()),
    update: vi.fn().mockReturnValue(createMockQueryChain()),
    delete: vi.fn().mockReturnValue(createMockQueryChain()),
    transaction: vi.fn(),
    $client: raw,
  };

  db.transaction.mockImplementation(async (cb: MockTransactionCallback<MockDb>): Promise<void> =>
    cb(db),
  );

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
