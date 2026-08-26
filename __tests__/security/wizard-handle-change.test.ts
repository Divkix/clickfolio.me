import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

/**
 * Regression tests for the wizard/complete handle-change rate limit.
 *
 * A re-onboarding user who changes their handle must be subject to the SAME
 * 3-per-24h handle_changes limit as PUT /api/profile/handle, and the change
 * must be recorded as a handleChanges audit row inside the same transaction.
 * First-time onboarding is exempt (no prior handle, no rate limit, no audit row).
 */

// ── Mocks ────────────────────────────────────────────────────────────

// Transaction capture: production writes run inside ONE db.transaction(cb);
// each awaited tx statement counts once and inserted rows are captured.
let txStatementCount = 0;
const txValues: UnknownRecord[] = [];

/** Owner contract for the mocked Drizzle transaction write chain. */
interface MockTxChain {
  set: (...args: unknown[]) => MockTxChain;
  where: (...args: unknown[]) => MockTxChain;
  values: (rows: UnknownRecord) => MockTxChain;
  onConflictDoNothing: (...args: unknown[]) => MockTxChain;
  onConflictDoUpdate: (...args: unknown[]) => MockTxChain;
  returning: (...args: unknown[]) => MockTxChain;
  then: (
    resolve: (value: undefined) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

const createTxChain = (): MockTxChain => {
  const chain: MockTxChain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    values: vi.fn((rows: UnknownRecord) => {
      txValues.push(rows);
      return chain;
    }),
    onConflictDoNothing: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    then: vi.fn((resolve: (value: undefined) => unknown) => {
      txStatementCount += 1;
      return Promise.resolve(resolve(undefined));
    }),
  };
  return chain;
};

const txUpdate = vi.fn(() => createTxChain());
const txInsert = vi.fn(() => createTxChain());

const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
  txStatementCount = 0;
  txValues.length = 0;
  await callback({ update: txUpdate, insert: txInsert });
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

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
  ne: vi.fn((_col, val) => val),
  and: vi.fn(() => "and"),
  gte: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray) => ({ strings })),
}));

vi.mock("@/lib/db/schema", () => ({
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
}));

vi.mock("@/lib/templates/theme-ids", () => ({
  THEME_IDS: ["minimalist_editorial", "neo_brutalist", "design_folio", "dev_terminal"],
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(),
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { handleChanges, siteData } from "@/lib/db/schema";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

// ── Helpers ──────────────────────────────────────────────────────────

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
    db: mockDb as never,
    dbUser: { id: "user_1", handle: "avery", clerkId: "user_clerk_1" },
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
});

// ── Tests ────────────────────────────────────────────────────────────

describe("wizard/complete handle-change rate limit", () => {
  it("returns 429 for an onboarded user changing handle with 3+ changes in 24h", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle", onboardingCompleted: true }]);
    selectResults.push([{ count: 3 }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(429);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("inserts the handleChanges audit row inside the transaction for an under-limit change", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle", onboardingCompleted: true }]);
    selectResults.push([{ count: 1 }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txStatementCount).toBe(3);

    // Statements: user update → siteData upsert → handleChanges audit row.
    expect(txInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(txInsert).toHaveBeenNthCalledWith(2, handleChanges);
    const auditValues = txValues.at(-1) as UnknownRecord;
    expect(auditValues).toMatchObject({
      userId: "user_1",
      oldHandle: "old-handle",
      newHandle: "avery",
    });
    expect(typeof auditValues.createdAt).toBe("string");
    expect(auditValues.oldHandle).not.toBeNull();
  });

  it("exempts first-time onboarding: no count query, no audit row", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    // Not onboarded yet — the wizard sets the initial handle.
    selectResults.push([{ handle: null, onboardingCompleted: false }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    // Only the current-user fetch ran (no rate-limit count query), and the
    // transaction wrote exactly two statements (update + siteData upsert).
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(txStatementCount).toBe(2);
    expect(txInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(txInsert).toHaveBeenCalledTimes(1);
  });

  it("skips the rate limit when an onboarded user keeps the same handle", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "avery", onboardingCompleted: true }]);

    await POST(requestWith(validBody));

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(txStatementCount).toBe(2);
    expect(txInsert).toHaveBeenCalledTimes(1);
  });
});
