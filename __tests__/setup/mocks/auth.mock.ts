/**
 * Mock factories for Better Auth sessions, users, and authentication contexts.
 *
 * All factories return plain objects that match the shapes returned by
 * Better Auth's `auth.api.getSession()` and the DB schema types.
 * Override specific fields via spread: `createMockUser({ isAdmin: true })`.
 */

import type { Session, User } from "@/lib/db/schema";
import type { PrivacySettings } from "@/lib/schemas/profile";

// ---------------------------------------------------------------------------
// User factory
// ---------------------------------------------------------------------------

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  show_phone: false,
  show_address: false,
  hide_from_search: false,
  show_in_directory: true,
};

interface CreateUserOverrides {
  id?: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  handle?: string;
  headline?: string;
  privacySettings?: string;
  onboardingCompleted?: boolean;
  role?: User["role"];
  roleSource?: User["roleSource"];
  referredBy?: string | null;
  isPro?: boolean;
  referralCount?: number;
  referralCode?: string;
  isAdmin?: boolean;
  showInDirectory?: boolean;
}

/**
 * Create a mock user row matching the `user` table schema.
 * Times default to a fixed ISO string for deterministic assertions.
 */
export function createMockUser(overrides: CreateUserOverrides = {}): User {
  const now = "2026-01-15T12:00:00.000Z";
  return {
    id: overrides.id ?? "user-test-uuid-001",
    name: overrides.name ?? "Test User",
    email: overrides.email ?? "test@example.com",
    emailVerified: overrides.emailVerified ?? true,
    image: overrides.image ?? null,
    createdAt: now,
    updatedAt: now,
    handle: overrides.handle ?? "testuser",
    headline: overrides.headline ?? "Software Engineer",
    privacySettings: overrides.privacySettings ?? JSON.stringify(DEFAULT_PRIVACY_SETTINGS),
    onboardingCompleted: overrides.onboardingCompleted ?? true,
    role: overrides.role ?? "mid_level",
    roleSource: overrides.roleSource ?? "user",
    referredBy: overrides.referredBy ?? null,
    referredAt: null,
    isPro: overrides.isPro ?? false,
    referralCount: overrides.referralCount ?? 0,
    referralCode: overrides.referralCode ?? "ABCD1234",
    isAdmin: overrides.isAdmin ?? false,
    showInDirectory: overrides.showInDirectory ?? true,
  };
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

interface CreateSessionOverrides {
  id?: string;
  userId?: string;
  token?: string;
  expiresAt?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create a mock session row matching the `session` table schema.
 */
export function createMockSession(overrides: CreateSessionOverrides = {}): Session {
  const now = "2026-01-15T12:00:00.000Z";
  const future = "2026-01-22T12:00:00.000Z";
  return {
    id: overrides.id ?? "session-test-uuid-001",
    userId: overrides.userId ?? "user-test-uuid-001",
    token: overrides.token ?? "mock-session-token-abc123",
    expiresAt: overrides.expiresAt ?? future,
    ipAddress: overrides.ipAddress ?? "127.0.0.1",
    userAgent: overrides.userAgent ?? "vitest/1.0",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Full auth session (Better Auth getSession response shape)
// ---------------------------------------------------------------------------

/**
 * Shape returned by `auth.api.getSession()`.
 * This is what API routes and middleware actually consume.
 */
interface AuthSessionOverrides {
  user?: Partial<ReturnType<typeof createMockUser>>;
  session?: Partial<ReturnType<typeof createMockSession>>;
}

/**
 * Create a mock Better Auth session object (what `getSession()` returns).
 * Includes both `session` and `user` with all fields that the auth middleware
 * and page components depend on.
 */
export function createMockAuthSession(overrides: AuthSessionOverrides = {}) {
  return {
    session: {
      ...createMockSession(),
      ...overrides.session,
    },
    user: {
      ...createMockUser(),
      ...overrides.user,
    },
  };
}

// ---------------------------------------------------------------------------
// Expired / invalid session helpers
// ---------------------------------------------------------------------------

/**
 * Session whose `expiresAt` is in the past.
 */
export function createExpiredAuthSession(overrides: AuthSessionOverrides = {}) {
  return {
    ...createMockAuthSession(overrides),
    session: {
      ...createMockSession(overrides.session),
      expiresAt: "2020-01-01T00:00:00.000Z",
    },
  };
}

/**
 * Null session — represents an unauthenticated request.
 */
export function createNullSession(): null {
  return null;
}

// ---------------------------------------------------------------------------
// Header helpers for mocking Next.js headers()
// ---------------------------------------------------------------------------

/**
 * Create mock headers with a session cookie set, suitable for passing to
 * `auth.api.getSession({ headers })`.
 */
export function createMockHeadersWithSession(
  token = "mock-session-token-abc123",
): Record<string, string> {
  return {
    cookie: `better-auth.session_token=${token}`,
    "user-agent": "vitest/1.0",
  };
}

/**
 * Create mock headers WITHOUT a session cookie.
 */
export function createMockHeadersWithoutSession(): Record<string, string> {
  return {
    "user-agent": "vitest/1.0",
  };
}

// ---------------------------------------------------------------------------
// Privacy settings helpers
// ---------------------------------------------------------------------------

export function createMockPrivacySettings(
  overrides: Partial<PrivacySettings> = {},
): PrivacySettings {
  return { ...DEFAULT_PRIVACY_SETTINGS, ...overrides };
}

// ---------------------------------------------------------------------------
// Convenience: admin user
// ---------------------------------------------------------------------------

export function createMockAdminUser(overrides: CreateUserOverrides = {}) {
  return createMockUser({ ...overrides, isAdmin: true });
}

// ---------------------------------------------------------------------------
// Convenience: user with handle
// ---------------------------------------------------------------------------

export function createMockUserWithHandle(handle: string, overrides: CreateUserOverrides = {}) {
  return createMockUser({ ...overrides, handle });
}
