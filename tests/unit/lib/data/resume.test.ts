import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ResumeContent } from "@/lib/types/database";
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

type RelatedProfileRow = {
  handle: string | null;
  name: string | null;
  headline: string | null;
  content: ResumeContent;
  privacySettings: {
    show_phone: boolean;
    show_address: boolean;
    hide_from_search: boolean;
    show_in_directory: boolean;
  };
};

type MockSelectRow = RelatedProfileRow | { n: number };

const mockUserFindFirst = vi.fn();

const mockSelectResults: MockSelectRow[][] = [];

const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  leftJoin: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  then: vi.fn((resolve: (rows: MockSelectRow[]) => MockSelectRow[]) =>
    resolve(mockSelectResults.shift() ?? []),
  ),
};

mockSelectChain.from.mockReturnValue(mockSelectChain);

mockSelectChain.where.mockReturnValue(mockSelectChain);

mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);

mockSelectChain.orderBy.mockReturnValue(mockSelectChain);

mockSelectChain.limit.mockReturnValue(mockSelectChain);

mockSelectChain.offset.mockReturnValue(mockSelectChain);

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
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockDb.select.mockReturnValue(mockSelectChain);
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
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockDb.select.mockReturnValue(mockSelectChain);
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

const indexableContent: ResumeContent = {
  full_name: "Ada Lovelace",
  headline: "Mathematician",
  summary:
    "Develops analytical methods for solving complex mathematical problems and communicating results to technical collaborators. Studies the capabilities of calculating machines and translates theoretical ideas into detailed procedures that others can review and reproduce. Works with engineers to clarify assumptions, check intermediate results, and document the practical limitations of proposed designs. Prepares explanatory notes that connect symbolic reasoning with applications in science and industry. Reviews published research, compares alternative approaches, and presents findings through clear examples. Recent work explores repeated operations, numerical sequences, and the organization of instructions for programmable machines, with an emphasis on accuracy, useful notation, and careful verification of every calculation.",
  contact: { email: "ada@example.com" },
  experience: [
    {
      title: "Software Engineer",
      company: "Example Co",
      location: "Remote",
      start_date: "2020-01",
      end_date: "Present",
      description: "Built example software.",
    },
  ],
  education: [],
  skills: [],
};

function relatedRow(
  handle: string,
  options: { hideFromSearch?: boolean; content?: ResumeContent } = {},
): RelatedProfileRow {
  return {
    handle,
    name: handle,
    headline: "Engineer",
    content: options.content ?? indexableContent,
    privacySettings: {
      show_phone: false,
      show_address: false,
      hide_from_search: options.hideFromSearch ?? false,
      show_in_directory: true,
    },
  };
}

describe("getRelatedProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResults.length = 0;
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.leftJoin.mockReturnValue(mockSelectChain);
    mockSelectChain.orderBy.mockReturnValue(mockSelectChain);
    mockDb.select.mockReturnValue(mockSelectChain);
  });

  it("returns only indexable profiles and excludes the current profile", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");

    const lowQualityContent: ResumeContent = {
      ...indexableContent,
      summary: "Brief",
      contact: { email: "" },
      experience: [],
      education: [],
    };

    mockSelectResults.push(
      [{ n: 7 }],
      [
        relatedRow("janedoe"),
        relatedRow("hidden", { hideFromSearch: true }),
        relatedRow("placeholder", {
          content: { ...indexableContent, full_name: "Jane Doe" },
        }),
        relatedRow("incomplete", { content: lowQualityContent }),
        relatedRow("alice"),
        relatedRow("bob"),
        relatedRow("carol"),
      ],
    );

    const result = await getRelatedProfiles("janedoe");

    expect(result.map((profile) => profile.handle).sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("limits related cards to three eligible profiles", async () => {
    const { getRelatedProfiles } = await import("@/lib/data/resume");
    mockSelectResults.push(
      [{ n: 5 }],
      [
        relatedRow("candidate-one"),
        relatedRow("candidate-two"),
        relatedRow("candidate-three"),
        relatedRow("candidate-four"),
        relatedRow("candidate-five"),
      ],
    );

    const result = await getRelatedProfiles("janedoe");

    expect(result).toHaveLength(3);
    expect(result.every((profile) => profile.handle.startsWith("candidate-"))).toBe(true);
  });
  it.each([
    { totalCount: 5, expectedOffset: 0 },
    { totalCount: 30, expectedOffset: 18 },
  ])(
    "bounds the related-profile offset for $totalCount profiles",
    async ({ totalCount, expectedOffset }) => {
      const { getRelatedProfiles } = await import("@/lib/data/resume");
      const random = vi.spyOn(Math, "random").mockReturnValue(0.99);

      try {
        mockSelectResults.push([{ n: totalCount }], []);
        await getRelatedProfiles("janedoe");
        expect(mockSelectChain.offset).toHaveBeenCalledWith(expectedOffset);
      } finally {
        random.mockRestore();
      }
    },
  );
});
