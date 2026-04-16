/**
 * Drizzle ORM + D1 mock factories for database operations.
 *
 * Provides lightweight stubs for Drizzle's query builder surface so tests
 * can assert on `.select()`, `.insert()`, `.where()`, etc. without a real
 * D1 binding. Each helper returns a vi.fn() mock that can be customised
 * per test via `.mockResolvedValue()` / `.mockReturnValue()`.
 */

import { vi } from "vitest";
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
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const handler: ProxyHandler<() => Promise<T[]>> = {
    get(_target, prop) {
      const strProp = String(prop);

      if (strProp === "then" || strProp === "toJSON") {
        // Make the chain awaitable — returns the rows
        return (_resolve: unknown, _reject: unknown) => Promise.resolve(rows);
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
    [K in string]: ReturnType<typeof vi.fn>;
  } & Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Mock database object
// ---------------------------------------------------------------------------

export interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
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
 */
export function createMockDb(): MockDb {
  return {
    select: vi.fn().mockReturnValue(createMockQueryChain()),
    insert: vi.fn().mockReturnValue(createMockQueryChain()),
    update: vi.fn().mockReturnValue(createMockQueryChain()),
    delete: vi.fn().mockReturnValue(createMockQueryChain()),
  };
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
