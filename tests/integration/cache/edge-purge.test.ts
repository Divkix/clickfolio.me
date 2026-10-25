import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { encodeCacheTag } from "@/lib/cache/edge-cache";
import {
  EDGE_PURGE_MAX_RETRIES,
  MAX_TAGS_PER_PURGE,
  MIN_PURGE_INTERVAL_MS,
  enqueueEdgePurge,
  processEdgePurgeBatch,
  retryDelaySeconds,
  type PurgeTags,
} from "@/lib/cache/edge-purge";
import { CachePurge, type PurgeResult } from "@/lib/effect/services/cache-purge";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { logLines } from "@/tests/helpers/log-lines";
import { fakeBatch, fakeMessage, fakeQueue } from "@/tests/helpers/queue";

const tag = (raw: string) => encodeCacheTag(raw);

const ok: PurgeResult = { success: true, errors: [] };

const noPause = vi.fn<(ms: number) => Promise<void>>(async () => {});

afterEach(() => {
  vi.restoreAllMocks();
  noPause.mockClear();
});

describe("processEdgePurgeBatch", () => {
  it("sends one purge with the deduplicated tags of every message", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const explore = tag("_N_T_/explore");

    const messages = [
      fakeMessage("a", { tags: [tag("_N_T_/@alice"), explore] }),
      fakeMessage("b", { tags: [tag("_N_T_/@bob"), explore] }),
      fakeMessage("c", { tags: [tag("_N_T_/@alice"), explore] }),
    ];

    const purge = vi.fn<PurgeTags>(async () => ok);

    await processEdgePurgeBatch(fakeBatch(messages), CachePurge.layerFrom(purge), noPause);

    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge.mock.calls[0]?.[0]).toEqual([tag("_N_T_/@alice"), explore, tag("_N_T_/@bob")]);

    for (const m of messages) {
      expect(m.ack).toHaveBeenCalledTimes(1);
      expect(m.retry).not.toHaveBeenCalled();
    }
  });

  it("never puts more than 100 tags in one purge and sends the overflow to the next batch", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const messages = Array.from({ length: 30 }, (_, i) =>
      fakeMessage(`m${i}`, { tags: [0, 1, 2, 3].map((j) => tag(`_N_T_/@user${i}-${j}`)) }),
    );

    const purge = vi.fn<PurgeTags>(async () => ok);

    await processEdgePurgeBatch(fakeBatch(messages), CachePurge.layerFrom(purge), noPause);

    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge.mock.calls[0]?.[0]).toHaveLength(MAX_TAGS_PER_PURGE);
    expect(messages.slice(0, 25).every((m) => m.ack.mock.calls.length === 1)).toBe(true);

    for (const m of messages.slice(25)) {
      expect(m.ack).not.toHaveBeenCalled();
      expect(m.retry).toHaveBeenCalledWith({ delaySeconds: 0 });
    }
  });

  it("retries every message with a growing delay when the purge reports success: false", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tags = [tag("_N_T_/@alice")];
    const first = fakeMessage("a", { tags }, 1);
    const third = fakeMessage("b", { tags }, 3);

    const purge = vi.fn<PurgeTags>(async () => ({
      success: false,
      errors: [{ code: 1015, message: "rate limited" }],
    }));

    await processEdgePurgeBatch(fakeBatch([first, third]), CachePurge.layerFrom(purge), noPause);

    expect(first.ack).not.toHaveBeenCalled();
    expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(third.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(logLines(error)).toEqual([
      expect.objectContaining({
        msg: "edge purge failed",
        tags,
        messageIds: ["a", "b"],
        max_attempts: 3,
        reason: "1015: rate limited",
      }),
    ]);
  });

  it("retries when the purge throws or the entrypoint has no cache", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = fakeMessage("a", { tags: [tag("_N_T_/@alice")] });
    const missing = fakeMessage("b", { tags: [tag("_N_T_/@bob")] });

    await processEdgePurgeBatch(
      fakeBatch([thrown]),
      CachePurge.layerFrom(vi.fn<PurgeTags>(async () => Promise.reject(new Error("rpc down")))),
      noPause,
    );
    await processEdgePurgeBatch(
      fakeBatch([missing]),
      CachePurge.layerFrom(vi.fn<PurgeTags>(async () => undefined)),
      noPause,
    );

    expect(thrown.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(missing.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(thrown.ack).not.toHaveBeenCalled();
    expect(missing.ack).not.toHaveBeenCalled();
  });

  it("retries a purge that outlives its timeout, then paces the next one", async () => {
    vi.useFakeTimers();

    try {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const stuck = fakeMessage("a", { tags: [tag("_N_T_/@alice")] });
      const purge = vi.fn<PurgeTags>(() => new Promise<never>(() => {}));

      const done = processEdgePurgeBatch(fakeBatch([stuck]), CachePurge.layerFrom(purge), noPause);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS.upstream + 1);
      await done;

      expect(purge).toHaveBeenCalledTimes(1);
      expect(stuck.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
      expect(stuck.ack).not.toHaveBeenCalled();
      expect(logLines(error)[0]).toMatchObject({
        msg: "edge purge failed",
        kind: "timeout",
        retryable: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("acks and logs a purge result it cannot read, since a retry cannot fix it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const unreadable = fakeMessage("a", { tags: [tag("_N_T_/@alice")] });
    // An RPC that answered outside the documented contract; parsed JSON is the untyped input.
    const garbage: PurgeResult = JSON.parse('{"ok":"yes"}');

    await processEdgePurgeBatch(
      fakeBatch([unreadable]),
      CachePurge.layerFrom(vi.fn<PurgeTags>(async () => garbage)),
      noPause,
    );

    expect(unreadable.ack).toHaveBeenCalledTimes(1);
    expect(unreadable.retry).not.toHaveBeenCalled();
    expect(logLines(error)[0]).toMatchObject({
      msg: "edge purge failed",
      kind: "invalid-response",
      retryable: false,
      reason: "unrecognized purge result",
    });
  });

  it("logs the dead-letter on the last attempt, leaving the move to the queue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tags = [tag("_N_T_/@alice")];
    const last = fakeMessage("a", { tags }, EDGE_PURGE_MAX_RETRIES + 1);

    await processEdgePurgeBatch(
      fakeBatch([last]),
      CachePurge.layerFrom(vi.fn<PurgeTags>(async () => undefined)),
      noPause,
    );

    // After max_retries the queue moves a retried message to the dead-letter queue.
    expect(last.retry).toHaveBeenCalledTimes(1);
    expect(logLines(error)).toContainEqual(
      expect.objectContaining({
        msg: "edge purge dead-lettered",
        tags,
        attempts: EDGE_PURGE_MAX_RETRIES + 1,
      }),
    );
  });

  it("acks malformed messages instead of retrying them into the dead-letter queue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = fakeMessage("raw", "_N_T_/@alice");
    const unencoded = fakeMessage("unencoded", { tags: ["_N_T_/@alice"] });
    const purge = vi.fn<PurgeTags>(async () => ok);

    await processEdgePurgeBatch(fakeBatch([raw, unencoded]), CachePurge.layerFrom(purge), noPause);

    expect(purge).not.toHaveBeenCalled();
    expect(raw.ack).toHaveBeenCalledTimes(1);
    expect(unencoded.ack).toHaveBeenCalledTimes(1);
    expect(logLines(error)).toHaveLength(2);
    // A handle in a malformed body never reaches the logs.
    expect(JSON.stringify(logLines(error))).not.toContain("alice");
  });

  it("holds the invocation open so one consumer stays under 5 purges a minute", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const pause = vi.fn<(ms: number) => Promise<void>>(async () => {});

    await processEdgePurgeBatch(
      fakeBatch([fakeMessage("a", { tags: [tag("x")] })]),
      CachePurge.layerFrom(vi.fn<PurgeTags>(async () => ok)),
      pause,
    );

    expect(pause).toHaveBeenCalledTimes(1);
    const waited = pause.mock.calls[0]?.[0] ?? 0;
    expect(waited).toBeGreaterThan(MIN_PURGE_INTERVAL_MS - 1000);
    expect(waited).toBeLessThanOrEqual(MIN_PURGE_INTERVAL_MS);
    expect(Math.floor(60_000 / MIN_PURGE_INTERVAL_MS)).toBeLessThanOrEqual(5);
  });
});

describe("edge purge consumer config", () => {
  const config = readFileSync(resolve(import.meta.dirname, "../../../wrangler.jsonc"), "utf8");
  const setting = (key: string) => Number(new RegExp(`"${key}":\\s*(\\d+)`).exec(config)?.[1]);

  it("matches the limits the consumer code assumes", () => {
    expect(setting("max_retries")).toBe(EDGE_PURGE_MAX_RETRIES);
    expect(setting("max_concurrency")).toBe(1);
    // Two handle tags per edit plus the shared tags stay under one purge.
    expect(setting("max_batch_size") * 2 + 3).toBeLessThanOrEqual(MAX_TAGS_PER_PURGE);
    expect(config).toContain('"dead_letter_queue": "clickfolio-cache-purge-dlq"');
  });
});

describe("retryDelaySeconds", () => {
  it("doubles from 30s and caps at 15 minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 480, 900, 900]);
  });
});

describe("enqueueEdgePurge", () => {
  it("sends deduplicated tags in one batch of messages of at most 100 tags", async () => {
    const queue = fakeQueue();
    const tags = Array.from({ length: 150 }, (_, i) => tag(`t${i}`));

    await enqueueEdgePurge(queue, [...tags, ...tags]);

    expect(queue.sendBatch).toHaveBeenCalledTimes(1);
    const sent = [...(queue.sendBatch.mock.calls[0]?.[0] ?? [])];
    expect(sent.map(({ body }) => body.tags.length)).toEqual([100, 50]);
  });

  it("never throws when the queue rejects, and logs the tags at error level", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const queue = fakeQueue(vi.fn(async () => Promise.reject(new Error("queue unavailable"))));
    const tags = [tag("_N_T_/@alice")];

    await expect(enqueueEdgePurge(queue, tags)).resolves.toBeUndefined();

    expect(logLines(error)[0]).toMatchObject({
      level: "error",
      msg: "edge purge enqueue failed",
      tags,
    });
  });

  it("logs a timed-out send with its kind and never resends it", async () => {
    vi.useFakeTimers();

    try {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const queue = fakeQueue(vi.fn(() => new Promise<never>(() => {})));
      const tags = [tag("_N_T_/@alice")];

      const pending = enqueueEdgePurge(queue, tags);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS.queue + 1);
      await pending;

      // The first send may still land, so a second one would only duplicate it.
      expect(queue.sendBatch).toHaveBeenCalledTimes(1);
      expect(logLines(error)[0]).toMatchObject({
        level: "error",
        msg: "edge purge enqueue failed",
        kind: "timeout",
        operation: "queue.edge_purge.send",
        tags,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to send a tag the consumer would drop as malformed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const queue = fakeQueue();

    await expect(enqueueEdgePurge(queue, ["_N_T_/@alice"])).resolves.toBeUndefined();

    expect(queue.sendBatch).not.toHaveBeenCalled();
    expect(logLines(error)[0]).toMatchObject({ msg: "edge purge enqueue failed" });
  });

  it("logs a missing binding instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await enqueueEdgePurge(undefined, [tag("x")]);

    expect(logLines(error)[0]).toMatchObject({ msg: "edge purge queue binding missing" });
  });
});
