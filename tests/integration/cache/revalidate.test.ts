import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EXAMPLES_CACHE_TAG, profileCacheTag } from "@/lib/cache/edge-cache";
import type { EdgePurgeMessage } from "@/lib/cache/edge-purge";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { logLines } from "@/tests/helpers/log-lines";
import { fakeQueue } from "@/tests/helpers/queue";

const mocks = vi.hoisted(() => {
  const pending: Array<Promise<unknown>> = [];

  return {
    queue: vi.fn<() => Queue<EdgePurgeMessage> | undefined>(),
    pending,
    waitUntil: vi.fn<(promise: Promise<unknown>) => void>(),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: {
    get EDGE_PURGE_QUEUE() {
      return mocks.queue();
    },
  },
  waitUntil: mocks.waitUntil,
}));

afterEach(() => {
  mocks.pending.length = 0;
  mocks.waitUntil.mockReset();
  vi.restoreAllMocks();
});

describe("revalidatePublicProfilePages", () => {
  it("queues a purge of each profile page and the galleries after the response", async () => {
    const queue = fakeQueue();
    mocks.queue.mockReturnValue(queue);
    mocks.waitUntil.mockImplementation((promise) => mocks.pending.push(promise));

    revalidatePublicProfilePages(["alice", null, undefined, "bob"]);
    await Promise.all(mocks.pending);

    expect(queue.sendBatch).toHaveBeenCalledTimes(1);
    const [[messages]] = queue.sendBatch.mock.calls;
    expect([...messages].flatMap((message) => message.body.tags).sort()).toEqual(
      [EXAMPLES_CACHE_TAG, profileCacheTag("alice"), profileCacheTag("bob")].sort(),
    );
  });

  it("logs a failed purge instead of failing the write that triggered it", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.waitUntil.mockImplementation(() => {
      throw new Error("no request context");
    });

    expect(() => revalidatePublicProfilePages(["alice"])).not.toThrow();
    expect(logLines(error)[0]).toMatchObject({
      level: "error",
      msg: "Failed to revalidate public profile pages",
    });
  });
});
