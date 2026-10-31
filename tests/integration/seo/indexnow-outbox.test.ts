import { eq, sql } from "drizzle-orm";
import { Effect, Exit, Layer } from "effect";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { siteConfig } from "@/lib/config/site";
import { indexNowState, indexNowUrls } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { IndexNow } from "@/lib/effect/services/indexnow";
import { drainIndexNow, enqueueIndexNow } from "@/lib/seo/indexnow-profiles";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const alice = `${siteConfig.url}/@alice`;
const bob = `${siteConfig.url}/@bob`;
const fetchMock = vi.fn<typeof fetch>();
let testDb: { db: TestDb; close(): Promise<void> };

function enqueue(urls: string[], force = false) {
  return Effect.runPromise(Effect.provide(enqueueIndexNow(urls, force), Db.layerFrom(testDb.db)));
}

function drain() {
  // Rebuild both layers every invocation, as distinct Worker isolates do.
  return Effect.runPromiseExit(
    Effect.provide(drainIndexNow(), Layer.merge(Db.layerFrom(testDb.db), IndexNow.layer())),
  );
}

async function pendingUrls() {
  return (await testDb.db.select().from(indexNowUrls).where(eq(indexNowUrls.pending, true)))
    .map(({ url }) => url)
    .sort();
}

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.execute(sql`TRUNCATE indexnow_urls, indexnow_state`);
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("durable IndexNow outbox", () => {
  it("coalesces duplicates and bursts across invocations into one batch without sending at enqueue", async () => {
    await enqueue([alice, alice]);
    await enqueue([alice, bob]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingUrls()).toEqual([alice, bob]);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).urlList.sort()).toEqual([
      alice,
      bob,
    ]);
    expect(await pendingUrls()).toEqual([]);
  });

  it("keeps 429 work without another profile edit and pauses every URL until Retry-After seconds", async () => {
    await enqueue([alice]);
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { "Retry-After": "1800" } }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // A rate limit is the expected path: the batch waits, the cron run succeeds.
    expect(Exit.isSuccess(await drain())).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"msg":"indexnow deferred"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"status":429'));
    expect(error).not.toHaveBeenCalled();
    await enqueue([bob], true);
    expect(await pendingUrls()).toEqual([alice, bob]);
    vi.mocked(Date.now).mockReturnValue(NOW + 1_799_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 1_800_000);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await pendingUrls()).toEqual([]);
  });

  it("honors Retry-After HTTP dates beyond the fallback backoff", async () => {
    await enqueue([alice]);
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 429,
        headers: { "Retry-After": "Sun, 01 Nov 2026 12:00:00 GMT" },
      }),
    );
    await drain();
    vi.mocked(Date.now).mockReturnValue(NOW + 86_399_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 86_400_000);
    await drain();
    expect(await pendingUrls()).toEqual([]);
  });

  it("backs off absent or malformed Retry-After exponentially, retaining the URLs", async () => {
    await enqueue([alice]);
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 429, headers: { "Retry-After": "invalid" } }),
    );
    await drain();
    vi.mocked(Date.now).mockReturnValue(NOW + 599_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 600_000);
    await drain();
    vi.mocked(Date.now).mockReturnValue(NOW + 1_799_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await pendingUrls()).toEqual([alice]);
  });

  it("keeps trailing edits until the ten-minute URL debounce expires, while forced removals bypass it", async () => {
    await enqueue([alice]);
    await drain();
    await enqueue([alice]);
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await pendingUrls()).toEqual([alice]);
    await enqueue([alice], true);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await pendingUrls()).toEqual([]);
  });

  it("does not erase a change queued while its earlier revision is in flight", async () => {
    await enqueue([alice]);
    fetchMock.mockImplementationOnce(async () => {
      await enqueue([alice], true);

      return new Response(null, { status: 202 });
    });
    await drain();
    expect(await pendingUrls()).toEqual([alice]);
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await pendingUrls()).toEqual([]);
  });

  it("leases the global sender before fetch and enforces the site-wide interval", async () => {
    await enqueue([alice]);
    fetchMock.mockImplementationOnce(async () => {
      await enqueue([bob], true);
      await drain();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      return new Response(null, { status: 200 });
    });
    await drain();
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await pendingUrls()).toEqual([bob]);
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await drain();
    expect(await pendingUrls()).toEqual([]);
  });

  it("recovers a sender that died after claiming without deleting its pending work", async () => {
    await enqueue([alice]);
    await testDb.db.insert(indexNowState).values({
      id: "site",
      nextAttemptAt: new Date(NOW).toISOString(),
      leaseId: "dead-worker",
      leaseUntil: new Date(NOW + 60_000).toISOString(),
    });
    await drain();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(NOW + 60_001);
    await drain();
    expect(await pendingUrls()).toEqual([]);
  });

  it("defers transport failures and fails only permanent refusals, never acknowledging lost work", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await enqueue([alice]);
    fetchMock.mockRejectedValueOnce(new TypeError("network disconnected"));
    expect(Exit.isSuccess(await drain())).toBe(true);
    expect(await pendingUrls()).toEqual([alice]);
    vi.mocked(Date.now).mockReturnValue(NOW + 600_000);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(Exit.isFailure(await drain())).toBe(true);
    expect(await pendingUrls()).toEqual([alice]);
  });

  it("bounds a batch and preserves overflow for a later interval", async () => {
    const urls = Array.from({ length: 1_001 }, (_, n) => `${siteConfig.url}/@profile-${n}`);
    await enqueue(urls);
    await drain();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).urlList).toHaveLength(1_000);
    expect(await pendingUrls()).toHaveLength(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await drain();
    expect(await pendingUrls()).toEqual([]);
  });
});

describe("IndexNow trailing delivery and retry recovery", () => {
  it("delivers an ordinary trailing change once its durable debounce expires", async () => {
    await enqueue([alice]);
    await drain();
    await enqueue([alice]);
    vi.mocked(Date.now).mockReturnValue(NOW + 599_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 600_000);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await pendingUrls()).toEqual([]);
  });

  it("keeps a 503 batch through Retry-After and resets the backoff after acceptance", async () => {
    await enqueue([alice]);
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 503,
        headers: { "Retry-After": "1200" },
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(Exit.isSuccess(await drain())).toBe(true);
    vi.mocked(Date.now).mockReturnValue(NOW + 1_199_999);
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Date.now).mockReturnValue(NOW + 1_200_000);
    await drain();
    const [state] = await testDb.db.select().from(indexNowState);
    expect(state).toMatchObject({ failures: 0, leaseId: null, leaseUntil: null });
    expect(await pendingUrls()).toEqual([]);
  });
});
