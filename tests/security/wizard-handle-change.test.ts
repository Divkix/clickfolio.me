import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

let txStatementCount = 0;

const txValues: UnknownRecord[] = [];

const txSelectResults: JsonValue[][] = [];

const txReturningResults: JsonValue[][] = [];

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

function makeTxBaseChain(): MockTxChain {
  const chain = {
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

function makeTxSelectChain(): MockTxChain {
  const chain = makeTxBaseChain();
  chain.then = vi.fn((resolve: (value: JsonValue) => JsonValue) =>
    Promise.resolve(resolve(nextTxSelect())),
  );

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

interface MockTx {
  update: typeof txUpdate;
  insert: typeof txInsert;
  select: typeof txSelect;
}

type WizardOutcome =
  | { kind: "ok"; oldHandle: string | null }
  | { kind: "missing_user" }
  | { kind: "stale" }
  | { kind: "rate_limited" };

type TxCallback = (tx: MockTx) => Promise<WizardOutcome>;

const mockTransaction = vi.fn(async (callback: TxCallback) => {
  txStatementCount = 0;
  txValues.length = 0;

  return callback({ update: txUpdate, insert: txInsert, select: txSelect });
});

let selectResults: JsonValue[][] = [];

const mockSelect = vi.fn(() => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: vi.fn((resolve: (value: JsonValue[]) => JsonValue) => {
      const next = selectResults.shift();

      if (next === undefined) {
        return Promise.reject(new Error("No select result queued"));
      }

      return Promise.resolve(resolve(next));
    }),
  };

  return chain;
});

const mockDb = {
  select: mockSelect,
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
  };
});

vi.mock("@/lib/db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/schema")>();

  return {
    ...actual,
    user: {
      id: "id",
      handle: "handle",
      onboardingCompleted: "onboardingCompleted",
      privacySettings: "privacySettings",
      showInDirectory: "showInDirectory",
      updatedAt: "updatedAt",
    },
    handleChanges: {
      id: "id",
      userId: "userId",
      oldHandle: "oldHandle",
      newHandle: "newHandle",
      createdAt: "createdAt",
    },
    siteData: {
      id: "id",
      userId: "userId",
      content: "content",
      themeId: "themeId",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      lastPublishedAt: "lastPublishedAt",
    },
  };
});

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
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
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

vi.mock("@/lib/rate-limit/handle-validation", () => ({
  isHandleTaken: vi.fn().mockResolvedValue(false),
  isValidHandleFormat: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/templates/theme-ids", () => ({
  THEME_IDS: ["minimalist_editorial", "neo_brutalist", "design_folio", "dev_terminal"],
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock("@/lib/utils/revalidate", () => ({
  revalidatePublicProfilePages: vi.fn(),
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { handleChanges, siteData } from "@/lib/db/schema";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

const validBody = {
  handle: "avery",
  privacy_settings: {
    show_phone: true,
    show_address: false,
    hide_from_search: false,
    show_in_directory: true,
  },
  theme_id: "minimalist_editorial",
};

function authed() {
  mockedAuth.mockResolvedValue({
    user: {
      id: "user_1",
      email: "avery@example.com",
      name: "Avery",
      image: null,
      handle: "avery",
      headline: null,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      onboardingCompleted: true,
      role: "mid_level",
    },
    // SAFETY: getDb is mocked to this select/transaction stub; PostgresJsDatabase cannot
    // be constructed in a unit test, and the route only runs the stubbed query chain.
    db: mockDb as never,
    dbUser: { id: "user_1", handle: "avery", clerkId: "user_clerk_1" },
    // SAFETY: these wizard tests never read an env binding — validation, handle checks,
    // and the database are all mocked above, so the empty env is never dereferenced.
    env: {} as never,
    error: null,
  });
}

function requestWith(body: JsonValue): Request {
  return new Request("https://clickfolio.me/api/wizard/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  authed();
  txStatementCount = 0;
  txValues.length = 0;
  txSelectResults.length = 0;
  txReturningResults.length = 0;
});

describe("wizard/complete handle-change rate limit", () => {
  it("returns 429 for an onboarded user changing handle with 3+ changes in 24h", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle" }]);
    selectResults.push([]);
    txSelectResults.push([{ handle: "old-handle" }]);
    txSelectResults.push([{ count: 3 }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(429);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("inserts the handleChanges audit row inside the transaction for an under-limit change", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle" }]);
    selectResults.push([]);
    txSelectResults.push([{ handle: "old-handle" }]);
    txSelectResults.push([{ count: 1 }]);
    txReturningResults.push([{ id: "user_1" }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txStatementCount).toBe(2);

    expect(txInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(txInsert).toHaveBeenNthCalledWith(2, handleChanges);
    const auditValues: UnknownRecord = txValues.at(-1) ?? {};
    expect(auditValues).toMatchObject({
      userId: "user_1",
      oldHandle: "old-handle",
      newHandle: "avery",
    });
    expect(auditValues.createdAt).toBeTypeOf("string");
    expect(auditValues.oldHandle).not.toBeNull();
  });

  it("first-time onboarding with a fresh handle writes one audit row", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: null }]);
    selectResults.push([]);
    // New handle differs from null, so the quota count runs inside the tx.
    txSelectResults.push([{ handle: null }]);
    txSelectResults.push([{ count: 0 }]);
    txReturningResults.push([{ id: "user_1" }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(txStatementCount).toBe(2);
    expect(txInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(txInsert).toHaveBeenNthCalledWith(2, handleChanges);
  });

  it("skips the rate limit when an onboarded user keeps the same handle", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "avery" }]);
    selectResults.push([]);
    txSelectResults.push([{ handle: "avery" }]);
    txReturningResults.push([{ id: "user_1" }]);

    await POST(requestWith(validBody));

    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(txStatementCount).toBe(1);
    expect(txInsert).toHaveBeenCalledTimes(1);
  });
});
