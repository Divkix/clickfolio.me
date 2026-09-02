/**
 * Drizzle ORM (Postgres / postgres-js) mock factories for database operations.
 *
 * Provides lightweight stubs for Drizzle's query builder surface so tests
 * can assert on `.select()`, `.insert()`, `.where()`, etc. without a real
 * Postgres connection. Each helper returns a vi.fn() mock that can be
 * customised per test via `.mockResolvedValue()` / `.mockReturnValue()`.
 *
 * jsonb semantics: jsonb columns select back as parsed objects/arrays, never
 * JSON strings — build fixtures for privacySettings, parsedContent,
 * parsedContentStaged, siteData.content and previewSkills as plain JS values.
 */

import { vi, type Mock } from "vite-plus/test";
import type { Resume } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Query chain builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock query builder.
 *
 * Usage:
 * ```ts
 * const select = createMockQueryChain<User>(mockUsers);
 * const result = await select.from(table).where(eq(...)).limit(10);
 * expect(result).toEqual(mockUsers);
 * ```
 *
 * Every method in the chain returns the builder itself so calls are composable.
 * The terminal method (`execute` / when awaited) resolves to the stored rows.
 */
export function createMockQueryChain<T = unknown>(rows: T[] = []) {
  const chain: Record<string, Mock> = {};
  const handler: ProxyHandler<() => Promise<T[]>> = {
    get(_target, prop) {
      const strProp = String(prop);

      if (strProp === "then") {
        // Make the chain awaitable — returns the rows
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

// ---------------------------------------------------------------------------
// Mock database object
// ---------------------------------------------------------------------------

/** The raw postgres-js client surface exposed as Drizzle's `$client`. */
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
  /** Drizzle transaction: invokes the callback with this mock db as `tx`. */
  transaction: Mock;
  /**
   * Raw postgres-js client exposed by Drizzle's postgres-js driver.
   * Callable as a tagged template (`db.$client\`...\``) resolving to a RowList
   * whose `.count` reports affected rows (default: 1); also carries minimal
   * prepare/sql/un surface for direct-SQL paths (e.g. conditional INSERT rate
   * limiting). Use `$client.mockResolvedValue({ count: 0 })` to simulate a
   * concurrent request winning the last slot, or `mockImplementation` to throw.
   */
  $client: SqlClient;
}

/**
 * Creates a mock Drizzle `db` object with stubbed top-level methods.
 * By default each method returns a chainable query builder (no rows).
 *
 * ```ts
 * const db = createMockDb();
 * db.select.mockReturnValue(createMockQueryChain([mockUser]));
 * const result = await db.select().from(userTable).where(eq(...));
 * ```
 *
 * `transaction(cb)` awaits `cb(db)` out of the box — the callback receives the
 * same mock db as its `tx` handle, so per-test chain stubs apply inside
 * transactions too. `$client` is the raw postgres-js client used for direct
 * SQL: calling it as a tagged template resolves `{ count: 1 }` by default.
 */
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
