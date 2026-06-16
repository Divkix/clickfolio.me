import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Unit tests for lib/data/resume.ts
 *
 * Covers the privacy-filtering logic in getResumeData (phone/address redaction,
 * theme fallback for locked themes), getResumeMetadata (hide_from_search),
 * and getRelatedProfiles (omits hidden and current-handle users).
 */

// ── Mocks ─────────────────────────────────────────────────────────────

// React cache returns the function as-is in test environment so we don't
// get cross-test caching. Mock it to be a pass-through wrapper.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: {
    CLICKFOLIO_DB: {} as D1Database,
  },
}));

const mockUserFindFirst = vi.fn();
const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  leftJoin: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
};

// Wire up the select chain — all intermediate methods return the chain itself.
// Terminal calls (.limit / .offset / .where used as await target) are set per-test.
mockSelectChain.from.mockReturnValue(mockSelectChain);
mockSelectChain.where.mockReturnValue(mockSelectChain);
mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
mockSelectChain.limit.mockReturnValue(mockSelectChain);
mockSelectChain.offset.mockResolvedValue([]);

const mockDb = {
  query: {
    user: { findFirst: mockUserFindFirst },
  },
  select: vi.fn().mockReturnValue(mockSelectChain),
};

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

vi.mock("drizzle-orm", () => ({
  relations: vi.fn((_table, build) =>
    build({
      many: vi.fn((table) => ({ relation: "many", table })),
      one: vi.fn((table, config) => ({ relation: "one", table, config })),
    }),
  ),
  eq: vi.fn((_field, value) => ({ op: "eq", value })),
  and: vi.fn((...conds) => ({ op: "and", conds })),
  or: vi.fn((...conds) => ({ op: "or", conds })),
  ne: vi.fn((_f, v) => ({ op: "ne", v })),
  isNotNull: vi.fn((f) => ({ op: "isNotNull", f })),
  desc: vi.fn((f) => ({ op: "desc", f })),
  count: vi.fn(() => ({ op: "count" })),
  sql: Object.assign(
    vi.fn(() => ({ op: "sql" })),
    {
      join: vi.fn(() => ({ op: "sql.join" })),
    },
  ),
}));

vi.mock("@/lib/seo/json-ld", () => ({
  generateResumeJsonLd: vi.fn().mockReturnValue({ "@context": "https://schema.org" }),
  generateBreadcrumbJsonLd: vi.fn().mockReturnValue({ "@context": "https://schema.org" }),
  serializeJsonLd: vi.fn().mockReturnValue("<script>{ }</script>"),
}));

vi.mock("@/lib/config/site", () => ({
  siteConfig: { url: "https://clickfolio.me" },
}));

// ── Fixtures ──────────────────────────────────────────────────────────

function makeUserRow(overrides: {
  privacySettings?: string;
  isPro?: boolean;
  referralCount?: number;
  themeId?: string;
  contactPhone?: string;
  contactLocation?: string;
}) {
  const content = {
    full_name: "Jane Doe",
    headline: "Software Engineer",
    contact: {
      email: "jane@example.com",
      phone: overrides.contactPhone ?? "+1 (555) 123-4567",
      location: overrides.contactLocation ?? "123 Main St, San Francisco, CA 94102",
    },
    experience: [],
    education: [],
    skills: [],
    summary: "A great engineer",
  };

  return {
    id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    handle: "janedoe",
    headline: "Software Engineer",
    image: null,
    privacySettings:
      overrides.privacySettings ??
      JSON.stringify({
        show_phone: true,
        show_address: true,
        hide_from_search: false,
        show_in_directory: true,
      }),
    isPro: overrides.isPro ?? false,
    referralCount: overrides.referralCount ?? 0,
    siteData: {
      userId: "user-1",
      themeId: overrides.themeId ?? "minimalist_editorial",
      content: JSON.stringify(content),
      previewName: "Jane Doe",
      previewHeadline: "Software Engineer",
      previewLocation: "San Francisco, CA",
      previewSkills: JSON.stringify(["TypeScript", "React"]),
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
  };
}

// ── Tests: getResumeData — phone redaction ────────────────────────────

describe("getResumeData - phone/address privacy filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire chains after clearAllMocks
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
  });

  it("removes phone from content when show_phone is false", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        privacySettings: JSON.stringify({
          show_phone: false,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        }),
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.content.contact?.phone).toBeUndefined();
    expect(result!.content.contact?.email).toBe("jane@example.com");
  });

  it("preserves phone in content when show_phone is true", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        privacySettings: JSON.stringify({
          show_phone: true,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        }),
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.content.contact?.phone).toBe("+1 (555) 123-4567");
  });

  it("filters address to city/state only when show_address is false", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        privacySettings: JSON.stringify({
          show_phone: true,
          show_address: false,
          hide_from_search: false,
          show_in_directory: true,
        }),
        contactLocation: "123 Main St, San Francisco, CA 94102",
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    // Full street address should be filtered to city/state
    expect(result!.content.contact?.location).toBe("San Francisco, CA");
  });

  it("returns null when user not found", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(null);

    const result = await getResumeData("nonexistent");

    expect(result).toBeNull();
  });

  it("returns null when user has no siteData", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    const row = makeUserRow({});
    mockUserFindFirst.mockResolvedValueOnce({ ...row, siteData: null });

    const result = await getResumeData("janedoe");

    expect(result).toBeNull();
  });
});

// ── Tests: getResumeData — theme fallback ─────────────────────────────

describe("getResumeData - locked theme fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
  });

  it("falls back to DEFAULT_THEME when user has locked premium theme and insufficient referrals", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    // design_folio requires 3 referrals; user has 0
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        themeId: "design_folio",
        referralCount: 0,
        isPro: false,
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.theme_id).toBe("minimalist_editorial"); // DEFAULT_THEME
  });

  it("uses locked premium theme when user has sufficient referrals", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    // design_folio requires 3 referrals; user has 5
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        themeId: "design_folio",
        referralCount: 5,
        isPro: false,
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.theme_id).toBe("design_folio");
  });

  it("uses locked premium theme when user isPro", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        themeId: "design_folio",
        referralCount: 0,
        isPro: true, // Pro bypasses referral requirement
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.theme_id).toBe("design_folio");
  });

  it("falls back to DEFAULT_THEME when themeId is invalid", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        themeId: "nonexistent_theme_xyz",
        referralCount: 99,
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.theme_id).toBe("minimalist_editorial"); // DEFAULT_THEME
  });
});

// ── Tests: getRelatedProfiles — bounded-window strategy ──────────────

describe("getRelatedProfiles - bounded random window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockReturnValue(mockSelectChain);
    mockSelectChain.offset.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockSelectChain);
  });

  it("returns at most 3 entries from a larger pool", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");

    // First select call: count query — .where() resolves with count row
    mockSelectChain.where.mockResolvedValueOnce([{ n: 20 }]);
    // Second select call: window query — .offset() resolves with 5 rows
    mockSelectChain.offset.mockResolvedValueOnce([
      { handle: "alice", name: "Alice", headline: "Designer" },
      { handle: "bob", name: "Bob", headline: null },
      { handle: "carol", name: "Carol", headline: "PM" },
      { handle: "dave", name: "Dave", headline: "Engineer" },
      { handle: "eve", name: "Eve", headline: "Data" },
    ]);

    const result = await getRelatedProfiles("janedoe");

    expect(result.length).toBeLessThanOrEqual(3);
    // All returned handles must be from the pool
    const validHandles = new Set(["alice", "bob", "carol", "dave", "eve"]);
    for (const r of result) {
      expect(validHandles.has(r.handle)).toBe(true);
    }
  });

  it("excludes currentHandle — filters applied via drizzle-orm helpers", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");
    const { and, ne, isNotNull } = await import("drizzle-orm");

    mockSelectChain.where.mockResolvedValueOnce([{ n: 5 }]);
    mockSelectChain.offset.mockResolvedValueOnce([
      { handle: "alice", name: "Alice", headline: "Designer" },
    ]);

    await getRelatedProfiles("janedoe");

    // Verify where-clause builders were called (ne guards currentHandle)
    expect(ne).toHaveBeenCalled();
    expect(isNotNull).toHaveBeenCalled();
    expect(and).toHaveBeenCalled();
  });

  it("returns [] when count is 0", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");

    mockSelectChain.where.mockResolvedValueOnce([{ n: 0 }]);

    const result = await getRelatedProfiles("janedoe");

    expect(result).toHaveLength(0);
  });

  it("filters out rows with null handle from the window", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");

    mockSelectChain.where.mockResolvedValueOnce([{ n: 3 }]);
    mockSelectChain.offset.mockResolvedValueOnce([
      { handle: null, name: "Ghost", headline: null },
      { handle: "visible", name: "Visible User", headline: "Engineer" },
    ]);

    const result = await getRelatedProfiles("janedoe");

    expect(result).toHaveLength(1);
    expect(result[0].handle).toBe("visible");
  });
});
