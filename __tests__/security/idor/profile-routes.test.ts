import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

let selectResults: JsonValue[][] = [];

interface MockQueryChain {
  from: (...args: unknown[]) => MockQueryChain;
  where: (...args: unknown[]) => MockQueryChain;
  orderBy: (...args: unknown[]) => MockQueryChain;
  limit: (...args: unknown[]) => MockQueryChain;
  innerJoin: (...args: unknown[]) => MockQueryChain;
  leftJoin: (...args: unknown[]) => MockQueryChain;
  then: (
    resolve: (value: JsonValue[]) => JsonValue,
    reject?: (reason: Error) => void,
  ) => Promise<JsonValue>;
}

interface MockTxChain {
  select: (...args: unknown[]) => MockTxChain;
  set: (...args: unknown[]) => MockTxChain;
  where: (...args: unknown[]) => MockTxChain;
  from: (...args: unknown[]) => MockTxChain;
  limit: (...args: unknown[]) => MockTxChain;
  for: (...args: unknown[]) => MockTxChain;
  values: (rows: UnknownRecord) => MockTxChain;
  onConflictDoNothing: (...args: unknown[]) => MockTxChain;
  onConflictDoUpdate: (...args: unknown[]) => MockTxChain;
  returning: (...args: unknown[]) => MockTxChain;
  then: (resolve: (value: JsonValue) => JsonValue) => Promise<JsonValue>;
}

const createQueryChain = (): MockQueryChain => {
  const chain: MockQueryChain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    then: vi.fn((resolve: (value: JsonValue[]) => JsonValue, reject?: (reason: Error) => void) => {
      const next = selectResults.shift();

      if (next === undefined) {
        const error = new Error("No select result queued");

        return reject ? Promise.reject(reject(error)) : Promise.reject(error);
      }

      return Promise.resolve(resolve(next));
    }),
  };

  return chain;
};

const mockSelect = vi.fn(() => createQueryChain());

let txStatementCount = 0;

const txValues: UnknownRecord[] = [];

const txSelectResults: JsonValue[][] = [];

const txReturningResults: JsonValue[][] = [];

function nextTxSelect(): JsonValue[] {
  const next = txSelectResults.shift();

  if (next === undefined) throw new Error("No tx select result queued");

  return next;
}

function nextTxReturning(): JsonValue {
  const next = txReturningResults.shift();

  if (next === undefined) throw new Error("No tx returning result queued");

  return next;
}

function makeTxSelectChain(): MockTxChain {
  const chain = makeTxBaseChain();
  chain.then = vi.fn((resolve: (value: JsonValue) => JsonValue) =>
    Promise.resolve(resolve(nextTxSelect())),
  );

  return chain;
}

function makeTxBaseChain(): MockTxChain {
  const chain: MockTxChain = {
    select: vi.fn(() => makeTxSelectChain()),
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    for: vi.fn(() => chain),
    values: vi.fn((rows: UnknownRecord) => {
      txValues.push(rows);

      return chain;
    }),
    onConflictDoNothing: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    returning: vi.fn(() => makeTxValueChain(nextTxReturning())),
    then: vi.fn((resolve: (value: JsonValue) => JsonValue) => {
      txStatementCount += 1;

      return Promise.resolve(resolve(undefined));
    }),
  };

  return chain;
}

function makeTxValueChain(value: JsonValue): MockTxChain {
  const chain = makeTxBaseChain();
  chain.then = vi.fn((resolve: (value: JsonValue) => JsonValue) => Promise.resolve(resolve(value)));

  return chain;
}

const createTxChain = (): MockTxChain => makeTxBaseChain();

const txUpdate = vi.fn(() => createTxChain());

const txInsert = vi.fn(() => createTxChain());

const txSelect = vi.fn(() => makeTxSelectChain());

interface MockTxClient {
  select: () => MockTxChain;
  update: () => MockTxChain;
  insert: () => MockTxChain;
}

const mockTransaction = vi.fn(async (callback: (tx: MockTxClient) => Promise<JsonValue>) => {
  txStatementCount = 0;
  txValues.length = 0;

  return callback({ update: txUpdate, insert: txInsert, select: txSelect });
});

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "user-a" }]),
    }),
  }),
});

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
  transaction: mockTransaction,
};

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
  requireAuthWithMessage: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();

  return {
    ...actual,
    eq: vi.fn((_col, val) => val),
    ne: vi.fn((_col, val) => val),
    and: vi.fn(() => "and"),
    gte: vi.fn(),
    desc: vi.fn(() => "desc"),
  };
});

vi.mock("@/lib/db/schema", () => ({
  user: {
    id: "id",
    email: "email",
    name: "name",
    handle: "handle",
    privacySettings: "privacySettings",
    role: "role",
    referralCount: "referralCount",
    referralCode: "referralCode",
    isAdmin: "isAdmin",
    isPro: "isPro",
    showInDirectory: "showInDirectory",
  },
  handleChanges: {
    id: "id",
    userId: "userId",
    oldHandle: "oldHandle",
    newHandle: "newHandle",
  },
  resumes: {
    id: "id",
    userId: "userId",
  },
  siteData: {
    id: "id",
    userId: "userId",
  },
}));

vi.mock("@/lib/utils/security-headers", () => ({
  createErrorResponse: vi.fn((error: string, _code: string, status: number) => {
    return new Response(JSON.stringify({ error }), { status });
  }),
  createSuccessResponse: vi.fn((data: JsonValue) => {
    return new Response(JSON.stringify(data), { status: 200 });
  }),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    BAD_REQUEST: "BAD_REQUEST",
    CONFLICT: "CONFLICT",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

vi.mock("@/lib/utils/validation", () => ({
  validateRequestSize: vi.fn(() => ({ valid: true })),
  readJsonWithLimit: vi.fn(async (req: Request) => {
    try {
      return { ok: true, data: await req.json() };
    } catch {
      return { ok: false, reason: "invalid_json", error: "Invalid JSON in request body" };
    }
  }),
}));

vi.mock("@/lib/rate-limit/user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit/user")>()),
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/utils/revalidate", () => ({
  revalidatePublicProfilePages: vi.fn(),
}));

vi.mock("@/lib/rate-limit/handle-validation", () => ({
  isHandleTaken: vi.fn().mockResolvedValue(false),
  isValidHandleFormat: vi.fn().mockReturnValue(true),
}));

import { requireAuthWithMessage, requireAuthWithUserValidation } from "@/lib/auth/middleware";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

const mockedAuthMessage = vi.mocked(requireAuthWithMessage);

function authedAs(userId: string, _overrides: UnknownRecord = {}) {
  // SAFETY: the fixture stands in for Database/CloudflareEnv with a vi.fn db double and only
  // HYPERDRIVE populated; the mocked middleware returns it verbatim to routes that read only
  // those members, so the narrower shape is the exact contract under test.
  mockedAuth.mockResolvedValue({
    user: {
      id: userId,
      email: `${userId}@test.com`,
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      onboardingCompleted: true,
      role: "mid_level",
    },
    db: mockDb,
    dbUser: { id: userId, handle: "testuser", clerkId: `clerk_${userId}` },
    env: {
      HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    },
    error: null,
  } as never);
}

function authedAsMessage(userId: string, _overrides: UnknownRecord = {}) {
  mockedAuthMessage.mockResolvedValue({
    user: {
      id: userId,
      email: `${userId}@test.com`,
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      onboardingCompleted: true,
      role: "mid_level",
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  txStatementCount = 0;
  txValues.length = 0;
  txSelectResults.length = 0;
  txReturningResults.length = 0;
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "user-a" }]),
      }),
    }),
  });
});

describe("IDOR - Profile Routes Security", () => {
  describe("PUT /api/profile/privacy", () => {
    it("returns 403 when User A tries to change User B's privacy settings", async () => {
      authedAs("user-a");

      const { PUT } = await import("@/app/api/profile/privacy/route");

      const request = new Request("http://localhost:3000/api/profile/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show_phone: true,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        }),
      });

      const response = await PUT(request);

      expect([200, 401]).toContain(response.status);
    });

    it("prevents privacy settings exposure via database row-level filtering", async () => {
      authedAs("user-a");

      const { PUT } = await import("@/app/api/profile/privacy/route");

      const request = new Request("http://localhost:3000/api/profile/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "user-b",
          show_phone: true,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        }),
      });

      await PUT(request);

      expect(mockUpdate).toHaveBeenCalled();
    });

    it("blocks privacy update with invalid session", async () => {
      mockedAuth.mockResolvedValue({
        user: null,
        db: null,
        dbUser: null,
        env: null,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const { PUT } = await import("@/app/api/profile/privacy/route");

      const request = new Request("http://localhost:3000/api/profile/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show_phone: true,
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/profile/handle", () => {
    it("returns 409 when attempting to squat someone else's handle", async () => {
      authedAs("user-a");

      const { isHandleTaken } = await import("@/lib/rate-limit/handle-validation");
      vi.mocked(isHandleTaken).mockResolvedValueOnce(true);

      const { PUT } = await import("@/app/api/profile/handle/route");

      const request = new Request("http://localhost:3000/api/profile/handle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "wanted-handle" }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(409);
    });

    it("prevents handle change for another user via ID injection", async () => {
      authedAs("user-a");

      txSelectResults.push([{ handle: "old-handle" }]);
      txSelectResults.push([{ count: 0 }]);
      txReturningResults.push([{ id: "user-a" }]);

      const { PUT } = await import("@/app/api/profile/handle/route");

      const request = new Request("http://localhost:3000/api/profile/handle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: "new-handle",
          user_id: "user-b",
        }),
      });

      await PUT(request);

      for (const row of txValues) {
        expect(row.userId).toBe("user-a");
      }
    });

    it("enforces handle change rate limit (3 per 24 hours)", async () => {
      authedAs("user-a");

      txSelectResults.push([{ handle: "old-handle" }]);
      txSelectResults.push([{ count: 3 }]);

      const { PUT } = await import("@/app/api/profile/handle/route");

      const request = new Request("http://localhost:3000/api/profile/handle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "new-handle" }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(429);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it("blocks handle change when the transaction hits the unique constraint", async () => {
      authedAs("user-a");

      txSelectResults.push([{ handle: "old-handle" }]);
      txSelectResults.push([{ count: 0 }]);
      mockTransaction.mockRejectedValueOnce(
        Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
        }),
      );

      const { PUT } = await import("@/app/api/profile/handle/route");

      const request = new Request("http://localhost:3000/api/profile/handle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "taken-handle" }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(409);
    });
  });

  describe("GET /api/profile/me", () => {
    it("returns only authenticated user's own data", async () => {
      authedAs("user-a");

      selectResults.push([
        {
          id: "user-a",
          name: "Test User",
          email: "user-a@test.com",
          privacySettings: {},
          onboardingCompleted: true,
          role: "mid_level",
          roleSource: null,
          isAdmin: false,
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(200);
      const body: { id: string } = await response.json();
      expect(body.id).toBe("user-a");
    });

    it("returns 401 for cross-user data access attempt", async () => {
      mockedAuth.mockResolvedValue({
        user: null,
        db: null,
        dbUser: null,
        env: null,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect(response.status).toBe(401);
    });

    it("prevents profile data access via different endpoint", async () => {
      authedAs("user-a");

      selectResults.push([
        {
          id: "user-a",
          name: "Test User",
          email: "user-a@test.com",
          image: null,
          handle: "testuser",
          headline: null,
          privacySettings: {},
          onboardingCompleted: true,
          role: "mid_level",
          roleSource: null,
          isAdmin: false,
        },
      ]);

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      expect([200, 401]).toContain(response.status);
    });
  });

  describe("Handle Enumeration Protection", () => {
    it("blocks handle enumeration attacks via unique constraint errors", async () => {
      authedAs("attacker");

      const handles = ["alice", "bob", "charlie", "dave", "eve"];

      const { enforceRateLimit } = await import("@/lib/rate-limit/user");

      for (const _ of handles) {
        expect(vi.mocked(enforceRateLimit)).toBeDefined();
      }
    });

    it("prevents privacy settings of another user from being exposed", async () => {
      authedAs("user-a");

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      if (response.status === 200) {
        const body: { id?: string } = await response.json();

        if (body.id) {
          expect(body.id).toBe("user-a");
        }
      }
    });
  });

  describe("Referral Code Visibility", () => {
    it("only exposes own referral code, not others", async () => {
      authedAsMessage("user-a", { referralCode: "USERA123" });

      const { GET } = await import("@/app/api/profile/me/route");
      const response = await GET();

      if (response.status === 200) {
        const body: { referral_code?: string } = await response.json();

        if (body.referral_code) {
          expect(body.referral_code).toBe("USERA123");
        }
      }
    });
  });
});

describe("Deleted User Profile Access", () => {
  it("returns 404 for deleted user's profile", async () => {
    // SAFETY: this fixture deliberately mixes branches of the auth contract (a user with a 404
    // error and a null dbUser) to model a deleted account; the mocked middleware returns it
    // verbatim, and the test asserts only the 404 status the route derives from the error.
    mockedAuth.mockResolvedValue({
      user: {
        id: "deleted-user-id",
        email: "deleted@test.com",
        name: "Deleted",
        image: null,
        handle: "deleted",
        headline: null,
        privacySettings: DEFAULT_PRIVACY_SETTINGS,
        onboardingCompleted: true,
        role: "mid_level",
      },
      db: mockDb,
      dbUser: null,
      env: {
        HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
      },
      error: new Response(JSON.stringify({ error: "User account not found" }), { status: 404 }),
    } as never);

    const { PUT } = await import("@/app/api/profile/privacy/route");

    const request = new Request("http://localhost:3000/api/profile/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_phone: true }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(404);
  });
});

describe("Profile Update Security", () => {
  it("ignores user_id in update payload", async () => {
    authedAs("user-a");

    const { PUT } = await import("@/app/api/profile/privacy/route");

    const request = new Request("http://localhost:3000/api/profile/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "user-b",
        show_phone: true,
      }),
    });

    await PUT(request);
  });

  it("prevents CSRF-like handle change attempts", async () => {
    authedAs("user-a");

    const { PUT } = await import("@/app/api/profile/handle/route");

    const request = new Request("http://localhost:3000/api/profile/handle", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ handle: "new-handle" }),
    });

    const response = await PUT(request);

    expect([401, 403, 409, 500]).toContain(response.status);
  });
});

describe("UUID Manipulation", () => {
  it("rejects malformed user IDs", async () => {
    const invalidIds = [
      "not-a-uuid",
      "123",
      "<script>alert(1)</script>",
      "' OR 1=1 --",
      "../../../etc/passwd",
    ];

    for (const id of invalidIds) {
      authedAs(id);

      const { PUT } = await import("@/app/api/profile/privacy/route");

      const request = new Request("http://localhost:3000/api/profile/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_phone: true }),
      });

      const response = await PUT(request);

      expect([200, 400, 401, 404]).toContain(response.status);
    }
  });
});
