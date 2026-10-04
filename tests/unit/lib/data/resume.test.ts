import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    cache: vi.fn((fn: (...args: JsonValue[]) => JsonValue) => fn),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: {
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

const mockUserFindFirst = vi.fn();

const mockDb = {
  query: {
    user: { findFirst: mockUserFindFirst },
  },
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

function makeUserRow(overrides: {
  privacySettings?: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search: boolean;
    show_in_directory: boolean;
  };
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
    privacySettings: overrides.privacySettings ?? {
      show_phone: true,
      show_address: true,
      hide_from_search: false,
      show_in_directory: true,
    },
    siteData: {
      userId: "user-1",
      themeId: overrides.themeId ?? "minimalist_editorial",
      content,
      previewName: "Jane Doe",
      previewHeadline: "Software Engineer",
      previewLocation: "San Francisco, CA",
      previewSkills: ["TypeScript", "React"],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
  };
}

describe("getResumeData - phone/address privacy filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes phone from content when show_phone is false", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        privacySettings: {
          show_phone: false,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        },
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
        privacySettings: {
          show_phone: true,
          show_address: true,
          hide_from_search: false,
          show_in_directory: true,
        },
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
        privacySettings: {
          show_phone: true,
          show_address: false,
          hide_from_search: false,
          show_in_directory: true,
        },
        contactLocation: "123 Main St, San Francisco, CA 94102",
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
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

describe("getResumeData - theme resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps any stored theme now that all themes are free", async () => {
    const { getResumeData } = await import("@/lib/data/resume");
    mockUserFindFirst.mockResolvedValueOnce(
      makeUserRow({
        themeId: "design_folio",
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
      }),
    );

    const result = await getResumeData("janedoe");

    expect(result).not.toBeNull();
    expect(result!.theme_id).toBe("minimalist_editorial");
  });
});
