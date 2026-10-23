import { encodeCloudflareCacheTag } from "@vinext/cloudflare/cache/cdn-adapter.runtime";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { QueuedPurgeCdnCacheAdapter } from "@/lib/cache/queued-cdn-adapter";
import { fakeQueue } from "@/tests/helpers/queue";

const SHARED_PAGE_POLICY = "s-maxage=300, stale-while-revalidate";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QueuedPurgeCdnCacheAdapter", () => {
  it("enqueues the same digests it stamps in Cache-Tag", async () => {
    const queue = fakeQueue();
    const adapter = new QueuedPurgeCdnCacheAdapter(queue);

    const headers = adapter.buildResponseHeaders({
      cacheControl: SHARED_PAGE_POLICY,
      tags: ["/@alice", "_N_T_/@alice", "_N_T_/layout", "_N_T_/[handle]/page"],
    });

    await adapter.revalidateTag(["_N_T_/@alice"]);

    const [sent] = [...(queue.sendBatch.mock.calls[0]?.[0] ?? [])];
    const digest = encodeCloudflareCacheTag("_N_T_/@alice");
    expect(sent?.body.tags).toEqual([digest]);
    expect(String(headers["Cache-Tag"]).split(",")).toContain(digest);
    expect(digest).toMatch(/^vinext-[0-9a-f]{32}$/);
  });

  it("keeps the edge TTL short and browsers revalidating", () => {
    const adapter = new QueuedPurgeCdnCacheAdapter(fakeQueue());

    const headers = adapter.buildResponseHeaders({
      cacheControl: SHARED_PAGE_POLICY,
      tags: ["_N_T_/@alice"],
    });

    expect(headers["Cloudflare-CDN-Cache-Control"]).toMatch(/^public, max-age=300\b/);
    expect(headers["Cache-Control"]).toBe("private, max-age=0, must-revalidate");
  });

  it("does not cache responses marked no-store", () => {
    const adapter = new QueuedPurgeCdnCacheAdapter(fakeQueue());

    const headers = adapter.buildResponseHeaders({
      cacheControl: "no-store",
      tags: ["_N_T_/@alice"],
    });

    expect(headers["Cloudflare-CDN-Cache-Control"]).toBeFalsy();
    expect(headers["Cache-Tag"]).toBeNull();
  });

  it("resolves even when the enqueue fails, so the user's write still succeeds", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new QueuedPurgeCdnCacheAdapter(
      fakeQueue(vi.fn(async () => Promise.reject(new Error("queue unavailable")))),
    );

    await expect(adapter.revalidateTag("_N_T_/@alice")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
