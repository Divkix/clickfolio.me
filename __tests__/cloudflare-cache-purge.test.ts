import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPublicPageCacheUrls,
  buildResumeCacheUrls,
  purgePublicPageCache,
  purgeResumeCache,
} from "@/lib/cloudflare-cache-purge";

describe("cloudflare cache purge helpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, errors: [], messages: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("builds both resume and OG URLs for handle purges", () => {
    expect(buildResumeCacheUrls("jane-doe", "https://clickfolio.me/")).toEqual([
      "https://clickfolio.me/@jane-doe",
      "https://clickfolio.me/api/og/jane-doe",
    ]);
  });

  it("builds deploy purge URLs for public pages", () => {
    expect(buildPublicPageCacheUrls("https://clickfolio.me/")).toEqual([
      "https://clickfolio.me",
      "https://clickfolio.me/privacy",
      "https://clickfolio.me/terms",
      "https://clickfolio.me/explore",
      "https://clickfolio.me/robots.txt",
      "https://clickfolio.me/sitemap.xml",
      "https://clickfolio.me/api/og/home",
    ]);
  });

  it("purges both resume assets in a single Cloudflare request", async () => {
    const success = await purgeResumeCache(
      "jane-doe",
      "https://clickfolio.me",
      "zone-id",
      "api-token",
    );

    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          files: ["https://clickfolio.me/@jane-doe", "https://clickfolio.me/api/og/jane-doe"],
        }),
      }),
    );
  });

  it("purges public deploy-sensitive pages in one request", async () => {
    const success = await purgePublicPageCache("https://clickfolio.me", "zone-id", "api-token");

    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          files: [
            "https://clickfolio.me",
            "https://clickfolio.me/privacy",
            "https://clickfolio.me/terms",
            "https://clickfolio.me/explore",
            "https://clickfolio.me/robots.txt",
            "https://clickfolio.me/sitemap.xml",
            "https://clickfolio.me/api/og/home",
          ],
        }),
      }),
    );
  });
});
