import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { siteConfig } from "@/lib/config/site";
import { indexNowUrls } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { createTestDb, type TestDb } from "@/tests/helpers/pglite-db";
import { logLines } from "@/tests/helpers/log-lines";

const { waitUntilMock } = vi.hoisted(() => ({ waitUntilMock: vi.fn() }));

vi.mock("cloudflare:workers", () => ({ env: { HYPERDRIVE: {} }, waitUntil: waitUntilMock }));

let testDb: { db: TestDb; close(): Promise<void> };
let pending: Promise<void> | undefined;

beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.close();
});
beforeEach(async () => {
  await testDb.db.execute(sql`TRUNCATE indexnow_urls, indexnow_state`);
  vi.spyOn(Db, "layer").mockImplementation(() => Db.layerFrom(testDb.db));
  waitUntilMock.mockReset();
  pending = undefined;
  waitUntilMock.mockImplementation((promise: Promise<void>) => {
    pending = promise;
  });
  vi.stubEnv("APP_URL", siteConfig.url);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function notify(handles: string[], force = false) {
  notifyIndexNowForProfiles(handles, { skipDebounce: force });

  if (!pending) throw new Error("waitUntil was not called");

  await pending;
}

describe("IndexNow runtime durable enqueue", () => {
  it("stores deduplicated work without fetching or depending on the colo cache", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("caches", { open: vi.fn(() => { throw new Error("cache unavailable"); }) });
    await notify(["alice", "alice"]);
    await notify(["alice", "bob"]);

    const rows = await testDb.db.select().from(indexNowUrls);

    expect(rows.map(({ url }) => url).sort()).toEqual([
      `${siteConfig.url}/@alice`, `${siteConfig.url}/@bob`,
    ]);
    expect(rows.every(({ pending: queued }) => queued)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves forced deletion/rename priority when another ordinary change arrives", async () => {
    await notify(["erin", "erin"], true);
    await notify(["erin"]);

    const [row] = await testDb.db.select().from(indexNowUrls)
      .where(eq(indexNowUrls.url, `${siteConfig.url}/@erin`));

    expect(row).toMatchObject({ pending: true, urgent: true });
  });

  it("logs a failed durable enqueue without exposing the handle or throwing", async () => {
    const closed = await createTestDb();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await closed.close();
    vi.mocked(Db.layer).mockImplementation(() => Db.layerFrom(closed.db));
    await expect(notify(["carol"])).resolves.toBeUndefined();
    expect(logLines(error)[0]).toMatchObject({ msg: "indexnow enqueue failed" });
    expect(JSON.stringify(logLines(error))).not.toContain("carol");
  });

  it("does nothing outside production or without handles", () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    notifyIndexNowForProfiles(["frank"]);
    vi.stubEnv("APP_URL", siteConfig.url);
    notifyIndexNowForProfiles([null, undefined, ""]);
    expect(waitUntilMock).not.toHaveBeenCalled();
  });
});
