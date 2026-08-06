import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  generateSitemapEntries: vi.fn(),
  buildSitemapXml: vi.fn(),
  getSitemapShardCount: vi.fn(),
  getTotalIndexableUserCount: vi.fn(),
}));

vi.mock("@/lib/seo/sitemap", () => ({
  generateSitemapEntries: (...args: unknown[]) => mocks.generateSitemapEntries(...args),
  buildSitemapXml: (...args: unknown[]) => mocks.buildSitemapXml(...args),
  getSitemapShardCount: (...args: unknown[]) => mocks.getSitemapShardCount(...args),
  getTotalIndexableUserCount: (...args: unknown[]) => mocks.getTotalIndexableUserCount(...args),
}));

describe("GET /sitemap/[id].xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTotalIndexableUserCount.mockResolvedValue(2);
    mocks.getSitemapShardCount.mockReturnValue(1);
    mocks.generateSitemapEntries.mockResolvedValue([{ url: "https://clickfolio.me/@jane" }]);
    mocks.buildSitemapXml.mockReturnValue('<?xml version="1.0"?><urlset></urlset>');
  });

  it("returns 200 with XML content-type for an in-range shard", async () => {
    const { GET } = await import("@/app/api/sitemap/[id]/route");
    const response = await GET(new Request("https://clickfolio.me/sitemap/0.xml"), {
      params: Promise.resolve({ id: "0" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml");
    expect(mocks.getTotalIndexableUserCount).toHaveBeenCalled();
    expect(mocks.generateSitemapEntries).toHaveBeenCalledWith(0);
  });

  it("returns 404 for an out-of-range shard id instead of 200-empty", async () => {
    const { GET } = await import("@/app/api/sitemap/[id]/route");
    const response = await GET(new Request("https://clickfolio.me/sitemap/1.xml"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.generateSitemapEntries).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    const { GET } = await import("@/app/api/sitemap/[id]/route");
    const response = await GET(new Request("https://clickfolio.me/sitemap/abc.xml"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for an id beyond a multi-shard index", async () => {
    mocks.getTotalIndexableUserCount.mockResolvedValue(150_000);
    mocks.getSitemapShardCount.mockReturnValue(4);

    const { GET } = await import("@/app/api/sitemap/[id]/route");
    const response = await GET(new Request("https://clickfolio.me/sitemap/4.xml"), {
      params: Promise.resolve({ id: "4" }),
    });

    expect(response.status).toBe(404);
  });

  it("serves content for the last valid shard of a multi-shard index", async () => {
    mocks.getTotalIndexableUserCount.mockResolvedValue(150_000);
    mocks.getSitemapShardCount.mockReturnValue(4);

    const { GET } = await import("@/app/api/sitemap/[id]/route");
    const response = await GET(new Request("https://clickfolio.me/sitemap/3.xml"), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.generateSitemapEntries).toHaveBeenCalledWith(3);
  });
});
