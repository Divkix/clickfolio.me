import type { MetadataRoute } from "next";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { getStaticLastmod } from "@/lib/seo/lastmod";
import { THEME_IDS, themeSlug } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import type { JsonValue } from "@/lib/types/json";

let mockSelectRows: JsonValue[] = [];

interface MockQueryChain {
  innerJoin: () => MockQueryChain;
  select: () => MockQueryChain;
  from: () => MockQueryChain;
  where: () => MockQueryChain;
  orderBy: () => MockQueryChain;
  then: (resolve: (value: JsonValue[]) => JsonValue) => JsonValue;
}

function buildQueryChain(rows: JsonValue[]): MockQueryChain {
  const chain = () => buildQueryChain(rows);

  return {
    innerJoin: vi.fn(() => chain()),
    select: vi.fn(() => chain()),
    from: vi.fn(() => chain()),
    where: vi.fn(() => chain()),
    orderBy: vi.fn(() => chain()),
    then: vi.fn((resolve: (value: JsonValue[]) => JsonValue) => resolve(rows)),
  };
}

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({ select: vi.fn(() => buildQueryChain(mockSelectRows)) })),
}));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

import {
  generateSitemapEntries,
  getNewestBlogPostDate,
  getSitemapShardCount,
  getTotalIndexableUserCount,
  STATIC_SITEMAP_ENTRY_COUNT,
  URLS_PER_SITEMAP,
} from "@/lib/seo/sitemap";

const indexableContent: ResumeContent = {
  full_name: "Ada Lovelace",
  headline: "Mathematician",
  summary:
    "Develops analytical methods for solving complex mathematical problems and communicating results to technical collaborators. Studies the capabilities of calculating machines and translates theoretical ideas into detailed procedures that others can review and reproduce. Works with engineers to clarify assumptions, check intermediate results, and document the practical limitations of proposed designs. Prepares explanatory notes that connect symbolic reasoning with applications in science and industry. Reviews published research, compares alternative approaches, and presents findings through clear examples. Recent work explores repeated operations, numerical sequences, and the organization of instructions for programmable machines, with an emphasis on accuracy, useful notation, and careful verification of every calculation.",
  contact: { email: "ada@example.com" },
  experience: [
    {
      title: "Mathematician",
      company: "Analytical Engines",
      location: "London",
      start_date: "1842",
      end_date: "1852",
      description: "Developed analytical methods.",
    },
  ],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

function profile(
  overrides: {
    handle?: string | null;
    userUpdatedAt?: string | null;
    siteUpdatedAt?: string | null;
    lastPublishedAt?: string | null;
    privacySettings?: { hide_from_search: boolean };
    content?: ResumeContent;
  } = {},
) {
  return {
    handle: "ada",
    userUpdatedAt: "2026-03-01T00:00:00Z",
    siteUpdatedAt: null,
    lastPublishedAt: null,
    privacySettings: { hide_from_search: false },
    content: indexableContent,
    ...overrides,
  };
}

describe("generateSitemapEntries", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://example.com");
    mockSelectRows = [];
  });

  it("returns an empty array for invalid IDs", async () => {
    expect(await generateSitemapEntries(-1)).toEqual([]);
    expect(await generateSitemapEntries(1.5)).toEqual([]);
  });

  it("includes static and profession URLs on the first shard", async () => {
    const entries = (await generateSitemapEntries(0)) ?? [];
    const urls = entries.map((entry: MetadataRoute.Sitemap[number]) => entry.url);

    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/privacy");
    expect(urls).toContain("https://example.com/terms");
    expect(urls).toContain("https://example.com/explore");
    expect(urls).toContain("https://example.com/blog");
    expect(urls).toContain("https://example.com/for/software-engineer");
    expect(urls).toContain("https://example.com/for/designer");
  });

  it("includes every template and gallery on shard zero with committed lastmods", async () => {
    const entries = (await generateSitemapEntries(0)) ?? [];

    const routes = [
      "/templates",
      ...THEME_IDS.map((id) => `/templates/${themeSlug(id)}`),
      ...EXAMPLE_GALLERIES.map((gallery) => `/examples/${gallery.slug}`),
    ];

    for (const route of routes) {
      expect(entries.find((entry) => entry.url === `https://example.com${route}`)).toEqual({
        url: `https://example.com${route}`,
        lastModified: getStaticLastmod(route),
        changeFrequency: "monthly",
        priority: route === "/templates" ? 0.8 : 0.7,
      });
    }
  });

  it("emits only profiles accepted by the shared indexability gate", async () => {
    mockSelectRows = [
      profile({ handle: "visible" }),
      profile({ handle: "hidden", privacySettings: { hide_from_search: true } }),
      profile({ handle: "placeholder", content: { ...indexableContent, full_name: " Unknown " } }),
      profile({
        handle: "incomplete",
        content: {
          ...indexableContent,
          full_name: "Ada",
          headline: "Engineer",
          summary: "x".repeat(200),
          contact: { email: "" },
          experience: [],
          education: [],
        },
      }),
    ];

    const entries = (await generateSitemapEntries(0)) ?? [];
    const profileUrls = entries.map((entry) => entry.url).filter((url) => url.includes("/@"));

    expect(profileUrls).toEqual(["https://example.com/@visible"]);
  });

  it("uses the indexable profile set for shard bounds and total counts", async () => {
    mockSelectRows = [
      profile({ handle: "visible" }),
      profile({ handle: "hidden", privacySettings: { hide_from_search: true } }),
      profile({ handle: "placeholder", content: { ...indexableContent, headline: "CV" } }),
    ];

    expect(await getTotalIndexableUserCount()).toBe(1);
    expect(await generateSitemapEntries(1)).toBeNull();
  });

  it("maps eligible profile rows to URLs and uses the preferred modified date", async () => {
    mockSelectRows = [
      profile({
        handle: "ada",
        userUpdatedAt: "2026-03-01T00:00:00Z",
        siteUpdatedAt: "2026-04-01T00:00:00Z",
      }),
    ];

    const entries = (await generateSitemapEntries(0)) ?? [];
    const profileEntry = entries.find((entry) => entry.url === "https://example.com/@ada");

    expect(profileEntry?.lastModified).toEqual(new Date("2026-04-01T00:00:00Z"));
    expect(profileEntry?.priority).toBe(0.8);
  });

  it("dates /explore from the newest indexable profile publish", async () => {
    mockSelectRows = [
      profile({ lastPublishedAt: "2026-09-20T08:30:00Z" }),
      profile({
        handle: "hidden",
        lastPublishedAt: "2026-09-28T08:30:00Z",
        privacySettings: { hide_from_search: true },
      }),
    ];

    const entries = (await generateSitemapEntries(0)) ?? [];
    const explore = entries.find((entry) => entry.url === "https://example.com/explore");

    expect(explore?.lastModified).toEqual(new Date("2026-09-20T08:30:00Z"));
  });

  it("falls back to the newest blog date if no indexable profile is published", async () => {
    mockSelectRows = [profile({ lastPublishedAt: null })];

    const entries = (await generateSitemapEntries(0)) ?? [];
    const explore = entries.find((entry) => entry.url === "https://example.com/explore");

    expect(explore?.lastModified).toEqual(getNewestBlogPostDate());
  });

  it("uses deterministic static lastmods", async () => {
    const first = (await generateSitemapEntries(0)) ?? [];
    const second = (await generateSitemapEntries(0)) ?? [];

    const lastmods = (entries: MetadataRoute.Sitemap) =>
      entries.map((entry) => [entry.url, new Date(entry.lastModified ?? 0).toISOString()]);

    expect(lastmods(second)).toEqual(lastmods(first));
  });
});

describe("getNewestBlogPostDate", () => {
  it("returns the newest dateModified ?? date across BLOG_POSTS", () => {
    const newest = BLOG_POSTS.map((post) => post.dateModified ?? post.date)
      .sort()
      .at(-1);

    expect(getNewestBlogPostDate()).toEqual(new Date(newest ?? ""));
  });
});

describe("getSitemapShardCount", () => {
  it("accounts for static URLs when deciding whether a second shard is needed", () => {
    const firstShardUserCapacity = URLS_PER_SITEMAP - STATIC_SITEMAP_ENTRY_COUNT;

    expect(getSitemapShardCount(firstShardUserCapacity)).toBe(1);
    expect(getSitemapShardCount(firstShardUserCapacity + 1)).toBe(2);
  });
});
