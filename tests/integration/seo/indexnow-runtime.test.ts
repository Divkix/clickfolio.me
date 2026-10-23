import { siteConfig } from "@/lib/config/site";
import type * as IndexNowModule from "@/lib/seo/indexnow";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { waitUntilMock, submitToIndexNowMock } = vi.hoisted(() => ({
  waitUntilMock: vi.fn(),
  submitToIndexNowMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ waitUntil: waitUntilMock }));

vi.mock("@/lib/seo/indexnow", async (importOriginal) => {
  const actual = await importOriginal<typeof IndexNowModule>();

  return { ...actual, submitToIndexNow: submitToIndexNowMock };
});

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
  submitToIndexNowMock.mockReset();
  waitUntilMock.mockReset();
  waitUntilMock.mockImplementation((promise: Promise<void>) => {
    pending = promise;
  });
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  vi.stubEnv("APP_URL", siteConfig.url);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function notify(handles: string[]): Promise<void> {
  pending = undefined;
  notifyIndexNowForProfiles(handles);

  const submission = pending;

  if (!submission) throw new Error("waitUntil was not called");

  return submission;
}

describe("IndexNow runtime debounce", () => {
  it("skips a URL after an accepted submission", async () => {
    submitToIndexNowMock.mockResolvedValue({ submitted: 1, statuses: [200] });

    await notify(["alice"]);

    expect(submitToIndexNowMock).toHaveBeenCalledWith([`${siteConfig.url}/@alice`]);
    expect(cache.put).toHaveBeenCalledTimes(1);

    await notify(["alice"]);

    expect(submitToIndexNowMock).toHaveBeenCalledTimes(1);
  });

  it("retries a URL whose submission was rejected", async () => {
    submitToIndexNowMock.mockResolvedValue({ submitted: 0, statuses: [429] });

    await notify(["bob"]);

    expect(cache.put).not.toHaveBeenCalled();

    submitToIndexNowMock.mockResolvedValue({ submitted: 1, statuses: [200] });

    await notify(["bob"]);

    expect(submitToIndexNowMock).toHaveBeenCalledTimes(2);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
});
