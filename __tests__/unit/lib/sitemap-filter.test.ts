import type { MetadataRoute } from "next";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";

let mockSelectRows: JsonValue[] = [];
let mockLimitValues: JsonValue[] = [];
let mockOffsetValues: JsonValue[] = [];

function buildQueryChain(rows: JsonValue[]) {
  const chain = () => buildQueryChain(rows);

  return {
    innerJoin: vi.fn(() => chain()),
    leftJoin: vi.fn(() => chain()),
    select: vi.fn(() => chain()),
    from: vi.fn(() => chain()),
    where: vi.fn(() => chain()),
    orderBy: vi.fn(() => chain()),
    limit: vi.fn((value: JsonValue) => {
      mockLimitValues.push(value);
      return chain();
    }),
    offset: vi.fn((value: JsonValue) => {
      mockOffsetValues.push(value);
      return chain();
    }),
    then: vi.fn((resolve: (v: JsonValue) => JsonValue) => resolve(rows)),
  };
}

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => buildQueryChain(mockSelectRows)),
  })),
}));

vi.mock("cloudflare:workers", () => ({
  env: { HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" } },
}));

import {
  generateSitemapEntries,
  getSitemapShardCount,
  getTotalIndexableUserCount,
  STATIC_SITEMAP_ENTRY_COUNT,
  URLS_PER_SITEMAP,
} from "@/lib/seo/sitemap";

describe("generateSitemapEntries", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://example.com");
    mockSelectRows = [];
    mockLimitValues = [];
    mockOffsetValues = [];
  });

  it("returns empty array for invalid id (negative)", async () => {
    const entries = await generateSitemapEntries(-1);
    expect(entries).toEqual([]);
  });

  it("returns empty array for non-integer id", async () => {
    const entries = await generateSitemapEntries(1.5);
    expect(entries).toEqual([]);
  });

  it("returns static pages for id=0 even when DB returns no users", async () => {
    const entries = await generateSitemapEntries(0);

    const urls = entries.map((e: MetadataRoute.Sitemap[number]) => e.url);
    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/privacy");
    expect(urls).toContain("https://example.com/terms");
    expect(urls).toContain("https://example.com/explore");
    expect(urls).toContain("https://example.com/blog");
  });

  it("includes profession pages for id=0", async () => {
    const entries = await generateSitemapEntries(0);

    const urls = entries.map((e: MetadataRoute.Sitemap[number]) => e.url);
    expect(urls).toContain("https://example.com/for/software-engineer");
    expect(urls).toContain("https://example.com/for/designer");
    expect(urls).toContain("https://example.com/for/marketer");
    expect(urls).toContain("https://example.com/for/student");
    expect(urls).toContain("https://example.com/for/consultant");
    expect(urls).toContain("https://example.com/for/product-manager");
  });

  it("has correct priority values for static pages", async () => {
    const entries = await generateSitemapEntries(0);

    const homeEntry = entries.find(
      (e: MetadataRoute.Sitemap[number]) => e.url === "https://example.com",
    );
    expect(homeEntry?.priority).toBe(1.0);

    const privacyEntry = entries.find(
      (e: MetadataRoute.Sitemap[number]) => e.url === "https://example.com/privacy",
    );
    expect(privacyEntry?.priority).toBe(0.3);

    const exploreEntry = entries.find(
      (e: MetadataRoute.Sitemap[number]) => e.url === "https://example.com/explore",
    );
    expect(exploreEntry?.priority).toBe(0.9);
  });

  it("maps DB user rows to sitemap entries with /@handle URLs", async () => {
    mockSelectRows = [
      { handle: "alice", userUpdatedAt: "2026-03-01T00:00:00Z", siteUpdatedAt: null },
      {
        handle: "bob",
        userUpdatedAt: "2026-03-15T00:00:00Z",
        siteUpdatedAt: "2026-04-01T00:00:00Z",
      },
    ];

    const entries = await generateSitemapEntries(0);

    const userUrls = entries
      .map((e: MetadataRoute.Sitemap[number]) => e.url)
      .filter((u: string) => u.includes("/@"));
    expect(userUrls).toHaveLength(2);
    expect(userUrls).toContain("https://example.com/@alice");
    expect(userUrls).toContain("https://example.com/@bob");
  });

  it("uses siteUpdatedAt for lastModified when available", async () => {
    mockSelectRows = [
      {
        handle: "testuser",
        userUpdatedAt: "2026-01-01T00:00:00Z",
        siteUpdatedAt: "2026-02-01T00:00:00Z",
      },
    ];

    const entries = await generateSitemapEntries(0);

    const userEntry = entries.find((e: MetadataRoute.Sitemap[number]) =>
      e.url.endsWith("/@testuser"),
    );
    expect(userEntry?.lastModified).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("falls back to userUpdatedAt when siteUpdatedAt is null", async () => {
    mockSelectRows = [
      { handle: "testuser", userUpdatedAt: "2026-03-15T00:00:00Z", siteUpdatedAt: null },
    ];

    const entries = await generateSitemapEntries(0);

    const userEntry = entries.find((e: MetadataRoute.Sitemap[number]) =>
      e.url.endsWith("/@testuser"),
    );
    expect(userEntry?.lastModified).toEqual(new Date("2026-03-15T00:00:00Z"));
  });

  it("uses current date when both dates are null", async () => {
    mockSelectRows = [{ handle: "testuser", userUpdatedAt: null, siteUpdatedAt: null }];

    const before = new Date();
    const entries = await generateSitemapEntries(0);
    const after = new Date();

    const userEntry = entries.find((e: MetadataRoute.Sitemap[number]) =>
      e.url.endsWith("/@testuser"),
    );
    const lastMod = userEntry?.lastModified as Date;
    expect(lastMod.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(lastMod.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it("skips DB rows with null handle (belt-and-suspenders)", async () => {
    mockSelectRows = [
      { handle: "valid", userUpdatedAt: "2026-01-01T00:00:00Z", siteUpdatedAt: null },
      { handle: null, userUpdatedAt: "2026-01-01T00:00:00Z", siteUpdatedAt: null },
      { handle: "another", userUpdatedAt: "2026-01-01T00:00:00Z", siteUpdatedAt: null },
    ];

    const entries = await generateSitemapEntries(10);

    const userUrls = entries.map((e: MetadataRoute.Sitemap[number]) => e.url);
    expect(userUrls).toHaveLength(2);
    expect(userUrls).toContain("https://example.com/@valid");
    expect(userUrls).toContain("https://example.com/@another");
    expect(userUrls.some((u: string) => u.endsWith("/@null"))).toBe(false);
  });

  it("returns only static pages for id=0 when DB returns empty", async () => {
    const entries = await generateSitemapEntries(0);

    const userUrls = entries
      .map((e: MetadataRoute.Sitemap[number]) => e.url)
      .filter((u: string) => u.includes("/@"));
    expect(userUrls).toHaveLength(0);

    const staticUrls = entries.map((e: MetadataRoute.Sitemap[number]) => e.url);
    expect(staticUrls).toContain("https://example.com");
  });

  it("returns only static pages for id=0 — no user entries from DB", async () => {
    const entries = await generateSitemapEntries(0);
    expect(entries.length).toBeGreaterThan(0);
    const userEntries = entries.filter((e: MetadataRoute.Sitemap[number]) => e.url.includes("/@"));
    expect(userEntries).toHaveLength(0);
  });

  it("reserves first shard capacity for static URLs", async () => {
    await generateSitemapEntries(0);

    expect(mockLimitValues.at(-1)).toBe(URLS_PER_SITEMAP - STATIC_SITEMAP_ENTRY_COUNT);
    expect(mockOffsetValues.at(-1)).toBe(0);
  });

  it("offsets later shards after the reduced first-shard user capacity", async () => {
    await generateSitemapEntries(1);

    expect(mockLimitValues.at(-1)).toBe(URLS_PER_SITEMAP);
    expect(mockOffsetValues.at(-1)).toBe(URLS_PER_SITEMAP - STATIC_SITEMAP_ENTRY_COUNT);
  });

  it("user entries have weekly changeFrequency and 0.8 priority", async () => {
    mockSelectRows = [
      { handle: "testuser", userUpdatedAt: "2026-01-01T00:00:00Z", siteUpdatedAt: null },
    ];

    const entries = await generateSitemapEntries(0);
    const userEntry = entries.find((e: MetadataRoute.Sitemap[number]) =>
      e.url.endsWith("/@testuser"),
    );

    expect(userEntry?.changeFrequency).toBe("weekly");
    expect(userEntry?.priority).toBe(0.8);
  });

  it("returns static pages when DB select throws (id=0)", async () => {
    mockSelectRows = [];

    const entries = await generateSitemapEntries(0);

    const urls = entries.map((e: MetadataRoute.Sitemap[number]) => e.url);
    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/privacy");
  });

  it("returns empty for id>0 when DB returns no users", async () => {
    mockSelectRows = [];
    const entries = await generateSitemapEntries(5);
    expect(entries).toEqual([]);
  });
});

describe("getTotalIndexableUserCount", () => {
  it("returns 0 when no users match", async () => {
    mockSelectRows = [];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(0);
  });

  it("returns the count value from the DB", async () => {
    mockSelectRows = [{ count: 42 }];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(42);
  });

  it("returns 0 when result[0] is undefined", async () => {
    mockSelectRows = [undefined];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(0);
  });

  it("returns 0 when count field is missing", async () => {
    mockSelectRows = [{}];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(0);
  });

  it("handles large count values", async () => {
    mockSelectRows = [{ count: 150000 }];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(150000);
  });

  it("queries count from user table with the same filter", async () => {
    mockSelectRows = [{ count: 5 }];
    const count = await getTotalIndexableUserCount();
    expect(count).toBe(5);
  });
});

describe("getSitemapShardCount", () => {
  it("accounts for static URLs when deciding whether a second shard is needed", () => {
    const firstShardUserCapacity = URLS_PER_SITEMAP - STATIC_SITEMAP_ENTRY_COUNT;

    expect(getSitemapShardCount(firstShardUserCapacity)).toBe(1);
    expect(getSitemapShardCount(firstShardUserCapacity + 1)).toBe(2);
  });
});
