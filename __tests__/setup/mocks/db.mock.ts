/**
 * Drizzle ORM + D1 mock factories for database operations.
 *
 * Provides lightweight stubs for Drizzle's query builder surface so tests
 * can assert on `.select()`, `.insert()`, `.where()`, etc. without a real
 * D1 binding. Each helper returns a vi.fn() mock that can be customised
 * per test via `.mockResolvedValue()` / `.mockReturnValue()`.
 */

import { vi } from "vitest";
import type {
  HandleChange,
  ReferralClick,
  Resume,
  Session,
  SiteData,
  UploadRateLimit,
  User,
} from "@/lib/db/schema";

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

// ---------------------------------------------------------------------------
// Transaction mock
// ---------------------------------------------------------------------------

/**
 * Creates a mock transaction wrapper.
 *
 * ```ts
 * const { transaction } = createMockTransaction();
 * await transaction(async (tx) => {
 *   await tx.insert(table).values(data);
 * });
 * expect(transaction).toHaveBeenCalledOnce();
 * ```
 */
export function createMockTransaction() {
  const txDb = createMockDb();
  const transaction = vi.fn().mockImplementation(async (fn: (tx: MockDb) => Promise<unknown>) => {
    return fn(txDb);
  });

  return { transaction, txDb };
}

// ---------------------------------------------------------------------------
// Factory data helpers — lightweight fixtures for common DB rows
// ---------------------------------------------------------------------------

export function createMockDbUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-db-uuid-001",
    name: "DB Test User",
    email: "db-test@example.com",
    emailVerified: true,
    image: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    handle: "dbtestuser",
    headline: null,
    privacySettings:
      '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}',
    onboardingCompleted: false,
    role: null,
    roleSource: null,
    referredBy: null,
    referredAt: null,
    isPro: false,
    referralCount: 0,
    referralCode: "DBCODE01",
    isAdmin: false,
    showInDirectory: true,
    ...overrides,
  };
}

export function createMockDbSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-db-uuid-001",
    userId: "user-db-uuid-001",
    token: "db-mock-token",
    expiresAt: "2026-01-22T12:00:00.000Z",
    ipAddress: "127.0.0.1",
    userAgent: "test",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
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

export function createMockDbSiteData(overrides: Partial<SiteData> = {}): SiteData {
  return {
    id: "sitedata-db-uuid-001",
    userId: "user-db-uuid-001",
    resumeId: "resume-db-uuid-001",
    content: "{}",
    themeId: "minimalist_editorial",
    lastPublishedAt: null,
    previewName: null,
    previewHeadline: null,
    previewLocation: null,
    previewExpCount: null,
    previewEduCount: null,
    previewSkills: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:05:00.000Z",
    ...overrides,
  };
}

export function createMockHandleChange(overrides: Partial<HandleChange> = {}): HandleChange {
  return {
    id: "hc-db-uuid-001",
    userId: "user-db-uuid-001",
    oldHandle: "oldhandle",
    newHandle: "newhandle",
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

export function createMockUploadRateLimit(
  overrides: Partial<UploadRateLimit> = {},
): UploadRateLimit {
  return {
    id: "rate-limit-uuid-001",
    ipHash: "hash123",
    actionType: "upload",
    createdAt: "2026-01-15T12:00:00.000Z",
    expiresAt: "2026-01-16T12:00:00.000Z",
    ...overrides,
  };
}

export function createMockReferralClick(overrides: Partial<ReferralClick> = {}): ReferralClick {
  return {
    id: "rc-db-uuid-001",
    referrerUserId: "user-db-uuid-001",
    visitorHash: "visitor-hash-abc",
    source: "homepage",
    converted: false,
    convertedUserId: null,
    convertedAt: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}
