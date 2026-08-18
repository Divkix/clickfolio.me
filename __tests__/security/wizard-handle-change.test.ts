import type { UnknownRecord, JsonValue } from "@/lib/types/json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Regression tests for the wizard/complete handle-change rate limit.
 *
 * A re-onboarding user who changes their handle must be subject to the SAME
 * 3-per-24h handle_changes limit as PUT /api/profile/handle, and the change
 * must be recorded as a handleChanges audit row inside the same db.batch().
 * First-time onboarding is exempt (no prior handle, no rate limit, no audit row).
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockCaptureBookmark = vi.fn().mockResolvedValue(undefined);
const mockBatch = vi.fn().mockResolvedValue(undefined);

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

const mockInsert = vi.fn(() => ({
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
}));

const mockUpdate = vi.fn(() => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
}));

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  batch: mockBatch,
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

vi.mock("@/lib/templates/theme-access", () => ({
  verifyThemeUnlocked: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/templates/theme-ids", () => ({
  THEME_IDS: ["minimalist_editorial", "neo_brutalist", "design_folio", "dev_terminal"],
}));

vi.mock("@/lib/posthog-server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
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
      privacySettings: "{}",
      onboardingCompleted: true,
      role: "mid_level",
    },
    db: mockDb as never,
    captureBookmark: mockCaptureBookmark,
    dbUser: { id: "user_1", handle: "avery" },
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
});

// ── Tests ────────────────────────────────────────────────────────────

describe("wizard/complete handle-change rate limit", () => {
  it("returns 429 for an onboarded user changing handle with 3+ changes in 24h", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle", onboardingCompleted: true }]);
    selectResults.push([{ count: 3 }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(429);
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("inserts the handleChanges audit row inside the batch for an under-limit change", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "old-handle", onboardingCompleted: true }]);
    selectResults.push([{ count: 1 }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    expect(mockBatch).toHaveBeenCalledTimes(1);
    const statements = mockBatch.mock.calls[0][0] as unknown[];
    expect(statements).toHaveLength(3);

    // Second db.insert call is the audit row for the handleChanges table.
    expect(mockInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(mockInsert).toHaveBeenNthCalledWith(2, handleChanges);
    const auditValues = (statements[2] as { values: { mock: { calls: JsonValue[][] } } }).values
      .mock.calls[0][0] as UnknownRecord;
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
    // Only the current-user fetch ran (no rate-limit count query).
    expect(mockSelect).toHaveBeenCalledTimes(1);
    const statements = mockBatch.mock.calls[0][0] as unknown[];
    expect(statements).toHaveLength(2);
    // No handleChanges insert.
    expect(mockInsert).toHaveBeenNthCalledWith(1, siteData);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("skips the rate limit when an onboarded user keeps the same handle", async () => {
    const { POST } = await import("@/app/api/wizard/complete/route");

    selectResults.push([{ handle: "avery", onboardingCompleted: true }]);

    const response = await POST(requestWith(validBody));

    expect(response.status).toBe(200);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    const statements = mockBatch.mock.calls[0][0] as unknown[];
    expect(statements).toHaveLength(2);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
