import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  filterSiteUrls,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  profileUrls,
  submitToIndexNow,
} from "@/lib/seo/indexnow";

const pending: Promise<void>[] = [];

vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: (promise: Promise<void>) => {
    pending.push(promise);
  },
}));

function okFetch(status = 200) {
  return vi.fn(async (_input: string, _init: RequestInit) => new Response(null, { status }));
}

describe("submitToIndexNow", () => {
  it("POSTs host, key, keyLocation and the URL list to the IndexNow endpoint", async () => {
    const fetchImpl = okFetch();

    const result = await submitToIndexNow(
      ["https://clickfolio.me/about", "https://clickfolio.me/blog"],
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      host: "clickfolio.me",
      key: INDEXNOW_KEY,
      keyLocation: `https://clickfolio.me/${INDEXNOW_KEY}.txt`,
      urlList: ["https://clickfolio.me/about", "https://clickfolio.me/blog"],
    });
    expect(result).toEqual({ submitted: 2, statuses: [200] });
  });

  it("counts 202 (key pending validation) as submitted", async () => {
    const result = await submitToIndexNow(["https://clickfolio.me/"], { fetchImpl: okFetch(202) });

    expect(result.submitted).toBe(1);
  });

  it("reports rejected batches without throwing", async () => {
    const result = await submitToIndexNow(["https://clickfolio.me/"], { fetchImpl: okFetch(403) });

    expect(result).toEqual({ submitted: 0, statuses: [403] });
  });

  it("never throws when fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(submitToIndexNow(["https://clickfolio.me/"], { fetchImpl })).resolves.toEqual({
      submitted: 0,
      statuses: [0],
    });
  });

  it("skips the request entirely when no URL belongs to the site", async () => {
    const fetchImpl = okFetch();

    const result = await submitToIndexNow(["https://example.com/x"], { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ submitted: 0, statuses: [] });
  });

  it("splits more than 10,000 URLs into protocol-sized batches", async () => {
    const fetchImpl = okFetch();
    const urls = Array.from({ length: 10_001 }, (_, i) => `https://clickfolio.me/p/${i}`);

    const result = await submitToIndexNow(urls, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.submitted).toBe(10_001);
  });
});

describe("filterSiteUrls / profileUrls", () => {
  it("keeps unique same-host URLs only", () => {
    expect(
      filterSiteUrls([
        "https://clickfolio.me/a",
        "https://clickfolio.me/a",
        "https://www.clickfolio.me/b",
        "not a url",
      ]),
    ).toEqual(["https://clickfolio.me/a"]);
  });

  it("builds /@handle URLs and skips missing handles", () => {
    expect(profileUrls(["jane", null, undefined, "bob"])).toEqual([
      "https://clickfolio.me/@jane",
      "https://clickfolio.me/@bob",
    ]);
  });
});

describe("notifyIndexNowForProfiles", () => {
  const fetchMock = okFetch();

  beforeEach(() => {
    pending.length = 0;
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("submits affected portfolio URLs after the response in production", async () => {
    vi.stubEnv("APP_URL", "https://clickfolio.me");
    const { notifyIndexNowForProfiles } = await import("@/lib/seo/indexnow-runtime");

    notifyIndexNowForProfiles(["old-handle", "new-handle"]);

    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).urlList).toEqual([
      "https://clickfolio.me/@old-handle",
      "https://clickfolio.me/@new-handle",
    ]);
  });

  it("does nothing outside production", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const { notifyIndexNowForProfiles } = await import("@/lib/seo/indexnow-runtime");

    notifyIndexNowForProfiles(["jane"]);

    expect(pending).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when no handle is known", async () => {
    vi.stubEnv("APP_URL", "https://clickfolio.me");
    const { notifyIndexNowForProfiles } = await import("@/lib/seo/indexnow-runtime");

    notifyIndexNowForProfiles([null]);

    expect(pending).toHaveLength(0);
  });

  it("debounces a URL already submitted within the window", async () => {
    vi.stubEnv("APP_URL", "https://clickfolio.me");
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async (key: string) => store.get(key),
        put: async (key: string, response: Response) => {
          store.set(key, response);
        },
      }),
    });
    const { notifyIndexNowForProfiles } = await import("@/lib/seo/indexnow-runtime");

    notifyIndexNowForProfiles(["jane"]);
    await Promise.all(pending);
    notifyIndexNowForProfiles(["jane"]);
    await Promise.all(pending);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
