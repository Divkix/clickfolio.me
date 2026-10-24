import { Effect, Layer } from "effect";
import { publicProfileTags } from "@/lib/cache/public-profile-paths";
import { siteConfig } from "@/lib/config/site";
import { QueueFailed } from "@/lib/effect/failures";
import { EdgePurgeQueue } from "@/lib/effect/services/edge-purge-queue";
import { IndexNow } from "@/lib/effect/services/indexnow";
import { refreshPublicProfiles } from "@/lib/parse/public-refresh";
import { profileUrls } from "@/lib/seo/indexnow";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));

vi.mock("@/lib/utils/log", () => ({ log: logMock, logEvent: vi.fn() }));

const sent: string[][] = [];
const submitted: string[][] = [];
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

const indexNow = Layer.succeed(IndexNow, {
  submit: (urls) =>
    Effect.sync(() => {
      submitted.push(urls);
    }),
  undebounced: (urls) => Effect.succeed(urls),
  markDebounced: () => Effect.void,
});

function refresh(handles: string[], appUrl: string | undefined) {
  return Effect.runPromise(
    Effect.provide(refreshPublicProfiles(handles, appUrl), Layer.mergeAll(queue, indexNow)),
  );
}

beforeEach(() => {
  sent.length = 0;
  submitted.length = 0;
  sendFails = false;
  logMock.mockClear();
});

describe("refreshPublicProfiles", () => {
  it("enqueues the profile, directory, example and sitemap tags and pings IndexNow in production", async () => {
    await refresh(["ada"], siteConfig.url);

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada"]).sort());
    expect(submitted).toEqual([profileUrls(["ada"])]);
  });

  it("purges but does not ping search engines outside the production site", async () => {
    await refresh(["ada"], "https://preview.example.dev");

    expect(sent.flat().sort()).toEqual(publicProfileTags(["ada"]).sort());
    expect(submitted).toEqual([]);
  });

  it("does nothing for no handles", async () => {
    await refresh([], siteConfig.url);

    expect(sent).toEqual([]);
    expect(submitted).toEqual([]);
  });

  it("logs a failed enqueue, still pings, and does not throw", async () => {
    sendFails = true;

    await expect(refresh(["ada"], siteConfig.url)).resolves.toBeUndefined();

    expect(logMock).toHaveBeenCalledWith(
      "error",
      "public page purge enqueue failed",
      expect.objectContaining({ operation: "queue.edge_purge.send", kind: "unavailable" }),
    );
    expect(submitted).toEqual([profileUrls(["ada"])]);
  });
});
