import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { R2Failed } from "@/lib/effect/failures";
import { R2ObjectMissing, R2Store } from "@/lib/effect/services/r2-store";

type FakeBucket = Parameters<typeof R2Store.layerFrom>[0];

function bucket(overrides: Partial<FakeBucket> = {}): FakeBucket {
  return {
    get: async () => null,
    put: async () => ({ size: 0, etag: "e" }),
    delete: async () => {},
    head: async () => null,
    list: async () => ({ objects: [], truncated: false }),
    ...overrides,
  };
}

function run<A, E>(program: Effect.Effect<A, E, R2Store>, layer: Layer.Layer<R2Store>) {
  return Effect.runPromise(Effect.provide(program, layer));
}

function fail<A, E>(program: Effect.Effect<A, E, R2Store>, layer: Layer.Layer<R2Store>) {
  return Effect.runPromise(Effect.flip(Effect.provide(program, layer)));
}

describe("R2Store", () => {
  it("returns the bytes of an existing object", async () => {
    const layer = R2Store.layerFrom(
      bucket({ get: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) }),
    );

    const bytes = await run(
      R2Store.use((store) => store.get("a")),
      layer,
    );

    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it("answers a missing key with R2ObjectMissing, not an outage", async () => {
    const layer = R2Store.layerFrom(bucket());

    const missing = await fail(
      R2Store.use((store) => store.get("users/u1/gone.pdf")),
      layer,
    );

    expect(missing).toBeInstanceOf(R2ObjectMissing);
    expect(missing.message).not.toContain("gone.pdf");

    const headMissing = await fail(
      R2Store.use((store) => store.head("users/u1/gone.pdf")),
      layer,
    );

    expect(headMissing).toBeInstanceOf(R2ObjectMissing);
  });

  it("answers an outage with R2Failed so it cannot pass for a missing key", async () => {
    const layer = R2Store.layerFrom(
      bucket({
        get: async () => {
          throw new Error("R2 GET failed. (10001)");
        },
      }),
    );

    const failure = await fail(
      R2Store.use((store) => store.get("a")),
      layer,
    );

    expect(failure).toBeInstanceOf(R2Failed);
    expect(failure).toMatchObject({ operation: "r2.get", kind: "unavailable" });
  });

  it("times out a hung call as R2Failed with kind timeout", async () => {
    vi.useFakeTimers();

    try {
      const layer = R2Store.layerFrom(bucket({ head: () => new Promise(() => {}) }));

      const pending = fail(
        R2Store.use((store) => store.head("a")),
        layer,
      );

      await vi.advanceTimersByTimeAsync(10_001);

      const failure = await pending;

      expect(failure).toBeInstanceOf(R2Failed);
      expect(failure).toMatchObject({ operation: "r2.head", kind: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes content type and metadata to put", async () => {
    const put = vi.fn(async () => ({ size: 3, etag: "x" }));
    const layer = R2Store.layerFrom(bucket({ put }));

    const info = await run(
      R2Store.use((store) =>
        store.put("k", new Uint8Array(3), {
          contentType: "application/pdf",
          customMetadata: { userId: "u" },
        }),
      ),
      layer,
    );

    expect(info).toEqual({ size: 3, etag: "x" });
    expect(put).toHaveBeenCalledWith("k", expect.any(Uint8Array), {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { userId: "u" },
    });
  });

  it("lists every page of a prefix", async () => {
    const list = vi
      .fn<FakeBucket["list"]>()
      .mockResolvedValueOnce({
        objects: [{ key: "a" }, { key: "b" }],
        truncated: true,
        cursor: "c1",
      })
      .mockResolvedValueOnce({ objects: [{ key: "c" }], truncated: false });

    const layer = R2Store.layerFrom(bucket({ list }));

    const keys = await run(
      R2Store.use((store) => store.listKeys("users/u1/")),
      layer,
    );

    expect(keys).toEqual(["a", "b", "c"]);
    expect(list.mock.calls[1][0]).toMatchObject({ prefix: "users/u1/", cursor: "c1" });
  });

  it("pings with a one-key listing", async () => {
    const list = vi.fn<FakeBucket["list"]>(async () => ({ objects: [], truncated: false }));

    await run(
      R2Store.use((store) => store.ping()),
      R2Store.layerFrom(bucket({ list })),
    );

    expect(list).toHaveBeenCalledWith({ prefix: "", limit: 1 });
  });

  it("fails a ping with R2Failed when the bucket does not answer", async () => {
    const failure = await fail(
      R2Store.use((store) => store.ping()),
      R2Store.layerFrom(
        bucket({
          list: async () => {
            throw new Error("R2 is down");
          },
        }),
      ),
    );

    expect(failure).toBeInstanceOf(R2Failed);
    expect(failure).toMatchObject({ operation: "r2.ping" });
  });

  it("fails every call as unavailable when the binding is not configured", async () => {
    const failure = await fail(
      R2Store.use((store) => store.delete("k")),
      R2Store.layer({}),
    );

    expect(failure).toMatchObject({ kind: "unavailable", operation: "r2.delete" });
  });
});
