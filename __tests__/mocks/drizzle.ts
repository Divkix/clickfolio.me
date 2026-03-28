/**
 * Shared Drizzle ORM mock utilities for tests
 * Standardizes database mock creation across test files
 */

import { vi } from "vitest";

/**
 * Mock result type for Drizzle operations
 */
export interface MockDrizzleResult {
  meta: { changes: number };
  results: Record<string, unknown>[];
}

/**
 * Options for creating a mock database
 */
export interface CreateMockDbOptions {
  batchResults?: MockDrizzleResult[];
  selectResults?: Record<string, unknown>[];
  deleteChanges?: number;
  updateChanges?: number;
  insertResults?: MockDrizzleResult;
}

/**
 * Creates a fully mocked Drizzle database instance
 * Returns an object with all chainable methods properly structured
 */
export function createMockDb(options: CreateMockDbOptions = {}) {
  const defaultResult: MockDrizzleResult = {
    meta: { changes: 0 },
    results: [],
  };

  const batchResults = options.batchResults ?? [defaultResult, defaultResult, defaultResult];

  // Build chainable query builders
  const createWhereChain = (runResult: unknown = { meta: { changes: 0 } }) => ({
    where: vi.fn().mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue(runResult),
        first: vi.fn().mockResolvedValue(null),
      }),
      limit: vi.fn().mockResolvedValue(options.selectResults ?? []),
      groupBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(options.selectResults ?? []),
      }),
      run: vi.fn().mockResolvedValue(runResult),
      returning: vi.fn().mockResolvedValue([]),
    }),
  });

  const createSetChain = () => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({
          meta: { changes: options.updateChanges ?? 0 },
        }),
      }),
    }),
  });

  const createValuesChain = () => ({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      onConflictDoUpdate: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      }),
      run: vi.fn().mockResolvedValue(options.insertResults ?? defaultResult),
      returning: vi.fn().mockResolvedValue([]),
    }),
  });

  return {
    batch: vi.fn().mockResolvedValue(batchResults),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(options.selectResults ?? []),
          groupBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(options.selectResults ?? []),
          }),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue(createWhereChain()),
    update: vi.fn().mockReturnValue(createSetChain()),
    insert: vi.fn().mockReturnValue(createValuesChain()),
    prepare: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
      all: vi.fn().mockResolvedValue([]),
    }),
    query: {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue(defaultResult),
    all: vi.fn().mockResolvedValue([]),
  };
}

/**
 * SQL builder mock for drizzle-orm/sql
 * Provides mock implementations for sql template functions
 */
export const mockSql = {
  join: vi.fn((values: unknown[]) => ({
    toString: () => values.join(", "),
    getSQL: () => ({ toString: () => values.join(", ") }),
  })),
  literal: vi.fn((val: unknown) => ({
    toString: () => String(val),
    getSQL: () => ({ toString: () => String(val) }),
  })),
  raw: vi.fn((sql: string) => ({
    toString: () => sql,
    getSQL: () => ({ toString: () => sql }),
  })),
};

/**
 * Creates a mock for sql tagged template literal
 * Usage: vi.mock("drizzle-orm", () => ({ sql: createMockSqlTag() }))
 */
export function createMockSqlTag() {
  return vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    toString: () => strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), ""),
    getSQL: () => ({
      toString: () => strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), ""),
    }),
  }));
}
