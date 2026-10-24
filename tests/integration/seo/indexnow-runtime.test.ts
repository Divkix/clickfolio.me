import { siteConfig } from "@/lib/config/site";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { INDEXNOW_ENDPOINT } from "@/lib/seo/indexnow";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { logLines } from "@/tests/helpers/log-lines";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { waitUntilMock } = vi.hoisted(() => ({ waitUntilMock: vi.fn() }));

vi.mock("cloudflare:workers", () => ({ waitUntil: waitUntilMock }));

const fetchMock = vi.fn<typeof fetch>();

const cacheEntries = new Map<string, Response>();

const cache = {
  match: vi.fn(async (key: string) => cacheEntries.get(key)),
  put: vi.fn(async (key: string, response: Response) => {
    cacheEntries.set(key, response);
  }),
};

let pending: Promise<void> | undefined;

beforeEach(() => {
  cacheEntries.clear();
  cache.match.mockClear();
  cache.put.mockClear();
  fetchMock.mockReset();
  waitUntilMock.mockReset();
  waitUntilMock.mockImplementation((promise: Promise<void>) => {
    pending = promise;
  });
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("APP_URL", siteConfig.url);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function notify(handles: string[]): Promise<void> {
  pending = undefined;
  notifyIndexNowForProfiles(handles);

  const submission = pending;

  if (!submission) throw new Error("waitUntil was not called");

  return submission;
}

function submittedUrls(call: number): string[] {
  const init = fetchMock.mock.calls[call]?.[1];

  return JSON.parse(String(init?.body)).urlList;
}

describe("IndexNow runtime debounce", () => {
  it("skips a URL after an accepted submission", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await notify(["alice"]);

    expect(fetchMock).toHaveBeenCalledWith(INDEXNOW_ENDPOINT, expect.anything());
    expect(submittedUrls(0)).toEqual([`${siteConfig.url}/@alice`]);
    expect(cache.put).toHaveBeenCalledTimes(1);

    await notify(["alice"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a URL whose submission was rejected", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    await notify(["bob"]);

    expect(cache.put).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await notify(["bob"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
});

describe("IndexNow runtime failures", () => {
  it("logs a refusal with its kind and no handle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(null, { status: 422 }));

    await notify(["carol"]);

    expect(logLines(warn)).toEqual([
      expect.objectContaining({
        msg: "indexnow submission failed",
        kind: "rejected",
        host: "indexnow",
      }),
    ]);
    expect(JSON.stringify(logLines(warn))).not.toContain("carol");
  });

  it("gives up on a hung endpoint at the upstream timeout without resending", async () => {
    vi.useFakeTimers();

    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      fetchMock.mockImplementation(() => new Promise<never>(() => {}));

      const done = notify(["dave"]);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS.upstream + 1);
      await done;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cache.put).not.toHaveBeenCalled();
      expect(logLines(warn)[0]).toMatchObject({
        msg: "indexnow submission failed",
        kind: "timeout",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("still pings, and says so, when the debounce cache is down", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cache.match.mockRejectedValueOnce(new Error("cache unavailable"));
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    await notify(["erin"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logLines(warn)[0]).toMatchObject({ msg: "indexnow debounce unavailable" });
  });

  it("does nothing outside production", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");

    notifyIndexNowForProfiles(["frank"]);

    expect(waitUntilMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
