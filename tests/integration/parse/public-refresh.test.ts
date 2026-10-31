import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect, Layer } from "effect";
import { publicProfileTags } from "@/lib/cache/edge-cache";
import { siteConfig } from "@/lib/config/site";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { indexNowUrls, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { QueueFailed } from "@/lib/effect/failures";
import { EdgePurgeQueue } from "@/lib/effect/services/edge-purge-queue";
import { refreshPublicProfiles } from "@/lib/parse/public-refresh";
import { profileUrls } from "@/lib/seo/indexnow";
import type { ResumeContent } from "@/lib/types/database";
import {
  createTestDb,
  INDEXABLE_CONTENT,
  THIN_CONTENT,
  type TestDb,
} from "@/tests/helpers/pglite-db";

const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));

vi.mock("@/lib/utils/log", () => ({ log: logMock, logEvent: vi.fn() }));

const sent: string[][] = [];
let sendFails = false;

const queue = Layer.succeed(EdgePurgeQueue, {
  sendBatch: (messages) =>
    sendFails
      ? Effect.fail(
          new QueueFailed({
            operation: "queue.edge_purge.send",
            kind: "unavailable",
            message: "queue unavailable",
          }),
        )
      : Effect.sync(() => {
          sent.push(messages.flatMap((message) => message.body.tags));
        }),
});


const NOW = "2026-01-01T00:00:00.000Z";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

function refresh(
  handles: string[],
  appUrl: string | undefined,
  dbLayer: Layer.Layer<Db> = Db.layerFrom(db),
) {
  return Effect.runPromise(
    Effect.provide(
      refreshPublicProfiles(handles, appUrl),
      Layer.mergeAll(queue, dbLayer),
    ),
  );
}

async function queuedUrls() {
  return (await db.select({ url: indexNowUrls.url }).from(indexNowUrls)).map(({ url }) => url);
}

async function seedProfile(handle: string, content: ResumeContent, hideFromSearch = false) {
  await db.insert(user).values({
    id: `id-${handle}`,
    name: handle,
    email: `${handle}@example.com`,
    handle,
    showInDirectory: true,
    onboardingCompleted: true,
    privacySettings: {
      show_email: true,
      show_phone: false,
      show_address: false,
      hide_from_search: hideFromSearch,
      show_in_directory: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
  });

  await db.insert(siteData).values({
    id: `site-${handle}`,
    userId: `id-${handle}`,
    ...siteDataContentColumns(content),
    createdAt: NOW,
    updatedAt: NOW,
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.db;
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  await db.delete(indexNowUrls);
  sent.length = 0;
  sendFails = false;
  logMock.mockClear();
});

describe("refreshPublicProfiles", () => {
  it("enqueues the profile, directory, example and sitemap tags and durable IndexNow work in production", async () => {
    await seedProfile("ada", INDEXABLE_CONTENT);

    await refresh(["ada"], siteConfig.url);

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada"]).sort());
    expect(await queuedUrls()).toEqual(profileUrls(["ada"]));
  });

  it("purges every rewritten profile but pings only the indexable ones", async () => {
    await seedProfile("ada", INDEXABLE_CONTENT);
    await seedProfile("thin", THIN_CONTENT);
    await seedProfile("hidden", INDEXABLE_CONTENT, true);

    await refresh(["ada", "thin", "hidden"], siteConfig.url);

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada", "thin", "hidden"]).sort());
    expect(await queuedUrls()).toEqual(profileUrls(["ada"]));
  });

  it("purges but does not ping search engines outside the production site", async () => {
    await refresh(["ada"], "https://preview.example.dev");

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada"]).sort());
    expect(await queuedUrls()).toEqual([]);
  });

  it("does nothing for no handles", async () => {
    await refresh([], siteConfig.url);

    expect(sent).toEqual([]);
    expect(await queuedUrls()).toEqual([]);
  });

  it("logs a failed enqueue, still pings, and does not throw", async () => {
    sendFails = true;
    await seedProfile("ada", INDEXABLE_CONTENT);

    await expect(refresh(["ada"], siteConfig.url)).resolves.toBeUndefined();

    expect(logMock).toHaveBeenCalledWith(
      "error",
      "public page purge enqueue failed",
      expect.objectContaining({ operation: "queue.edge_purge.send", kind: "unavailable" }),
    );
    expect(await queuedUrls()).toEqual(profileUrls(["ada"]));
  });

  it("logs a failed indexability lookup, skips the ping, and does not throw", async () => {
    const closed = await createTestDb();

    await closed.close();

    await expect(
      refresh(["ada"], siteConfig.url, Db.layerFrom(closed.db)),
    ).resolves.toBeUndefined();

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada"]).sort());
    expect(await queuedUrls()).toEqual([]);
    expect(logMock).toHaveBeenCalledWith(
      "error",
      "public page indexnow lookup failed",
      expect.objectContaining({ operation: "public-refresh.indexable-handles" }),
    );
  });
});
