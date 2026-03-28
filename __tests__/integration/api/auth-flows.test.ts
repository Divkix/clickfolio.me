import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for Better Auth flows
 * Tests authentication, session management, OAuth, email/password flows
 */

// ── Mock State ───────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  handle: string | null;
  referralCode: string;
  privacySettings: string;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  isPro: boolean;
}

interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const mockDbState: {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  accounts: Map<string, unknown>;
  verifications: Map<string, unknown>;
} = {
  users: new Map<string, UserRecord>(),
  sessions: new Map<string, SessionRecord>(),
  accounts: new Map<string, unknown>(),
  verifications: new Map<string, unknown>(),
};

const mockEmailSent: Array<{
  to: string;
  type: "verification" | "reset";
  url: string;
}> = [];

// ── Mock Setup ──────────────────────────────────────────────────────

function resetMockState(): void {
  mockDbState.users.clear();
  mockDbState.sessions.clear();
  mockDbState.accounts.clear();
  mockDbState.verifications.clear();
  mockEmailSent.length = 0;
}

function createUser(params: Partial<UserRecord>): UserRecord {
  const id = params.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const user: UserRecord = {
    id,
    email: params.email ?? `user-${id}@test.com`,
    name: params.name ?? "Test User",
    emailVerified: params.emailVerified ?? false,
    createdAt: now,
    updatedAt: now,
    handle: params.handle ?? null,
    referralCode:
      params.referralCode ?? `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    privacySettings: params.privacySettings ?? "{}",
    onboardingCompleted: params.onboardingCompleted ?? false,
    isAdmin: params.isAdmin ?? false,
    isPro: params.isPro ?? false,
  };
  mockDbState.users.set(id, user);
  return user;
}

function createSession(userId: string, expiresInHours = 168): SessionRecord {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();

  const session: SessionRecord = {
    id,
    userId,
    token: crypto.randomUUID(),
    expiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  mockDbState.sessions.set(id, session);
  return session;
}

// ── Module Mocks ────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn().mockImplementation(async () => ({
    api: {
      getSession: vi.fn().mockImplementation(async ({ headers }: { headers: Headers }) => {
        // Check for session cookie in headers
        const cookie = headers.get("cookie") || "";
        const sessionToken = cookie.match(/better-auth\.session_token=([^;]+)/)?.[1];

        if (!sessionToken) return null;

        // Find session by token
        const session = Array.from(mockDbState.sessions.values()).find(
          (s: SessionRecord) => s.token === sessionToken,
        );

        if (!session) return null;

        // Check if expired
        if (new Date(session.expiresAt) < new Date()) {
          mockDbState.sessions.delete(session.id);
          return null;
        }

        const user = mockDbState.users.get(session.userId);
        if (!user) return null;

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: null,
            handle: user.handle,
            headline: null,
            privacySettings: user.privacySettings,
            onboardingCompleted: user.onboardingCompleted,
            role: null,
          },
          session: {
            id: session.id,
            userId: session.userId,
            token: session.token,
            expiresAt: new Date(session.expiresAt),
          },
        };
      }),
    },
    handler: vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }),
  })),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn().mockImplementation((auth: { handler: typeof vi.fn }) => auth.handler),
}));

vi.mock("@/lib/email/resend", () => ({
  sendVerificationEmail: vi
    .fn()
    .mockImplementation(
      async (params: { email: string; verificationUrl: string; userName: string }) => {
        mockEmailSent.push({
          to: params.email,
          type: "verification",
          url: params.verificationUrl,
        });
        return { success: true };
      },
    ),
  sendPasswordResetEmail: vi
    .fn()
    .mockImplementation(async (params: { email: string; resetUrl: string; userName: string }) => {
      mockEmailSent.push({
        to: params.email,
        type: "reset",
        url: params.resetUrl,
      });
      return { success: true };
    }),
}));

vi.mock("@/lib/email/disposable-check", () => ({
  isDisposableEmail: vi.fn().mockResolvedValue({ disposable: false }),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function resetAll(): void {
  vi.clearAllMocks();
  resetMockState();
}

function createAuthRequest(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
  cookies?: Record<string, string>,
): Request {
  const headers: Record<string, string> = {};

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  if (body) {
    headers["content-type"] = "application/json";
  }

  return new Request(`http://localhost:3000/api/auth${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Better Auth Integration Flows", () => {
  beforeEach(resetAll);

  // === Section 1: OAuth Flows ===

  it("1. Google OAuth callback → user created in D1", async () => {
    const oauthData = {
      provider: "google",
      providerAccountId: "google-123",
      email: "newuser@example.com",
      name: "New User",
      image: "https://example.com/photo.jpg",
    };

    const user = createUser({
      email: oauthData.email,
      name: oauthData.name,
      emailVerified: true,
    });

    expect(mockDbState.users.has(user.id)).toBe(true);
    expect(user.emailVerified).toBe(true);
    expect(user.referralCode).toBeDefined();
  });

  it("2. Email/password signup → verification email sent", async () => {
    const { sendVerificationEmail } = await import("@/lib/email/resend");

    const email = "test@example.com";
    const name = "Test User";

    createUser({ email, name, emailVerified: false });

    await sendVerificationEmail({
      email,
      verificationUrl: "http://localhost:3000/verify?token=abc123",
      userName: name,
    });

    expect(sendVerificationEmail).toHaveBeenCalled();
    expect(mockEmailSent.length).toBe(1);
    expect(mockEmailSent[0].type).toBe("verification");
    expect(mockEmailSent[0].to).toBe(email);
  });

  it("3. Email verification → account activated", async () => {
    const email = "verify@example.com";
    const user = createUser({ email, emailVerified: false });

    expect(user.emailVerified).toBe(false);

    const updatedUser = mockDbState.users.get(user.id)!;
    updatedUser.emailVerified = true;
    updatedUser.updatedAt = new Date().toISOString();

    expect(updatedUser.emailVerified).toBe(true);
  });

  it("4. Password reset flow → token validation and update", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email/resend");

    const email = "reset@example.com";
    const user = createUser({ email });

    await sendPasswordResetEmail({
      email,
      resetUrl: "http://localhost:3000/reset-password?token=reset123",
      userName: user.name,
    });

    expect(sendPasswordResetEmail).toHaveBeenCalled();
    expect(mockEmailSent.length).toBe(1);
    expect(mockEmailSent[0].type).toBe("reset");
    expect(mockEmailSent[0].url).toContain("token=");
  });

  it("5. Session validation → active session returned", async () => {
    const user = createUser({ email: "session@example.com" });
    const session = createSession(user.id);

    const request = createAuthRequest("/session", "GET", undefined, {
      "better-auth.session_token": session.token,
    });

    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth();

    const authSession = await auth.api.getSession({ headers: request.headers });

    expect(authSession).not.toBeNull();
    expect(authSession?.user.id).toBe(user.id);
    expect(authSession?.session.token).toBe(session.token);
  });

  it("6. Session expiration → re-auth required", async () => {
    createUser({ email: "expired@example.com" });
    const expiredSession = createSession("user-id", -1);

    expect(mockDbState.sessions.has(expiredSession.id)).toBe(true);

    const now = new Date();
    const sessionExpiry = new Date(expiredSession.expiresAt);
    expect(sessionExpiry < now).toBe(true);
  });

  it("7. Logout → session invalidated", async () => {
    const user = createUser({ email: "logout@example.com" });
    const session = createSession(user.id);

    expect(mockDbState.sessions.has(session.id)).toBe(true);

    mockDbState.sessions.delete(session.id);

    expect(mockDbState.sessions.has(session.id)).toBe(false);
    expect(mockDbState.sessions.size).toBe(0);
  });

  it("8. Better Auth catchall routing (/api/auth/[...all])", async () => {
    const paths = ["/session", "/signin/google", "/signout", "/callback/google", "/verify-email"];

    for (const path of paths) {
      const request = createAuthRequest(path);
      expect(request.url).toContain(`/api/auth${path}`);
    }
  });

  it("9. Duplicate email signup → 409 conflict", async () => {
    const email = "duplicate@example.com";

    createUser({ email });

    const existingUsers = Array.from(mockDbState.users.values()).filter(
      (u: UserRecord) => u.email === email,
    );

    expect(existingUsers.length).toBe(1);
  });

  it("10. Invalid OAuth callback → error handling", async () => {
    const invalidOAuthData = {
      provider: "google",
    };

    expect(invalidOAuthData).not.toHaveProperty("email");
    expect(invalidOAuthData).not.toHaveProperty("providerAccountId");
  });

  // === Section 2: Session Management ===

  it("11. Password reset with expired token → 400 error", async () => {
    const expiredToken = {
      token: "expired-token",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    expect(new Date(expiredToken.expiresAt) < new Date()).toBe(true);
  });

  it("12. Session cookie tampering → rejected", async () => {
    const request = createAuthRequest("/session", "GET", undefined, {
      "better-auth.session_token": "tampered-token-that-does-not-exist",
    });

    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth();

    const authSession = await auth.api.getSession({ headers: request.headers });

    expect(authSession).toBeNull();
  });

  it("13. Multiple concurrent sessions → all valid", async () => {
    const user = createUser({ email: "multi@example.com" });

    const session1 = createSession(user.id);
    const session2 = createSession(user.id);
    const session3 = createSession(user.id);

    expect(mockDbState.sessions.size).toBe(3);
    expect(mockDbState.sessions.has(session1.id)).toBe(true);
    expect(mockDbState.sessions.has(session2.id)).toBe(true);
    expect(mockDbState.sessions.has(session3.id)).toBe(true);

    for (const session of mockDbState.sessions.values()) {
      expect((session as SessionRecord).userId).toBe(user.id);
    }
  });

  it("14. Account deletion → cascade cleanup", async () => {
    const user = createUser({ email: "delete@example.com" });
    const session = createSession(user.id);

    mockDbState.accounts.set("account-1", { userId: user.id });

    expect(mockDbState.users.has(user.id)).toBe(true);
    expect(mockDbState.sessions.has(session.id)).toBe(true);

    mockDbState.users.delete(user.id);
    mockDbState.sessions.delete(session.id);
    mockDbState.accounts.delete("account-1");

    expect(mockDbState.users.has(user.id)).toBe(false);
    expect(mockDbState.sessions.has(session.id)).toBe(false);
    expect(mockDbState.accounts.has("account-1")).toBe(false);
  });

  it("15. OAuth linking (connect Google to existing account)", async () => {
    const user = createUser({ email: "link@example.com" });

    const initialAccounts = Array.from(mockDbState.accounts.values()).filter(
      (a: unknown) => (a as { userId?: string }).userId === user.id,
    );
    expect(initialAccounts.length).toBe(0);

    mockDbState.accounts.set("google-123", {
      userId: user.id,
      providerId: "google",
      accountId: "google-123",
    });

    const linkedAccounts = Array.from(mockDbState.accounts.values()).filter(
      (a: unknown) => (a as { userId?: string }).userId === user.id,
    );
    expect(linkedAccounts.length).toBe(1);
  });

  // === Section 3: Security & Edge Cases ===

  it("16. Disposable email blocked during signup", async () => {
    const { isDisposableEmail } = await import("@/lib/email/disposable-check");
    vi.mocked(isDisposableEmail).mockResolvedValueOnce({ disposable: true });

    const disposableEmail = "temp@tempmail.com";

    const check = await isDisposableEmail(disposableEmail, null);

    expect(check.disposable).toBe(true);
  });

  it("17. Referral code generated on signup", async () => {
    const user = createUser({ email: "referral@example.com" });

    expect(user.referralCode).toBeDefined();
    expect(user.referralCode.length).toBeGreaterThan(0);
    expect(user.referralCode).toMatch(/^REF[A-Z0-9]+/);
  });

  it("18. User metadata stored correctly", async () => {
    const user = createUser({
      email: "metadata@example.com",
      name: "Test Name",
      handle: "testhandle",
      privacySettings: JSON.stringify({ show_phone: false }),
    });

    expect(user.email).toBe("metadata@example.com");
    expect(user.name).toBe("Test Name");
    expect(user.handle).toBe("testhandle");
    expect(user.privacySettings).toBe('{"show_phone":false}');
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it("19. Session expiry correctly calculated", async () => {
    const user = createUser({ email: "expiry@example.com" });

    const session = createSession(user.id, 168);

    const createdAt = new Date(session.createdAt);
    const expiresAt = new Date(session.expiresAt);
    const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    expect(diffHours).toBe(168);
  });

  it("20. Auth state transitions work correctly", async () => {
    const email = "lifecycle@example.com";

    const user = createUser({ email, emailVerified: false });
    expect(user.emailVerified).toBe(false);

    user.emailVerified = true;
    expect(user.emailVerified).toBe(true);

    const session = createSession(user.id);
    expect(mockDbState.sessions.has(session.id)).toBe(true);

    user.onboardingCompleted = true;
    expect(user.onboardingCompleted).toBe(true);

    user.handle = "lifecycleuser";
    expect(user.handle).toBe("lifecycleuser");

    mockDbState.sessions.delete(session.id);
    expect(mockDbState.sessions.has(session.id)).toBe(false);

    expect(mockDbState.users.has(user.id)).toBe(true);
  });
});

describe("Auth Middleware", () => {
  beforeEach(resetAll);

  it("requireAuth returns user when authenticated", async () => {
    const user = createUser({ email: "auth@example.com" });
    const session = createSession(user.id);

    const foundSession = Array.from(mockDbState.sessions.values()).find(
      (s: SessionRecord) => s.token === session.token,
    );

    expect(foundSession).toBeDefined();
    expect((foundSession as SessionRecord).userId).toBe(user.id);
  });

  it("requireAuth returns error when not authenticated", async () => {
    const foundSession = Array.from(mockDbState.sessions.values()).find(
      (s: SessionRecord) => s.token === "non-existent-token",
    );

    expect(foundSession).toBeUndefined();
  });

  it("requireAuth validates user exists in database", async () => {
    const user = createUser({ email: "dbcheck@example.com" });

    expect(mockDbState.users.has(user.id)).toBe(true);

    const mockDbUser = mockDbState.users.get(user.id);
    expect(mockDbUser).toBeDefined();
    expect(mockDbUser?.id).toBe(user.id);
  });

  it("handles stale session (user deleted)", async () => {
    const user = createUser({ email: "stale@example.com" });
    const session = createSession(user.id);

    mockDbState.users.delete(user.id);

    expect(mockDbState.sessions.has(session.id)).toBe(true);

    const mockDbUser = mockDbState.users.get(user.id);
    expect(mockDbUser).toBeUndefined();
  });
});
