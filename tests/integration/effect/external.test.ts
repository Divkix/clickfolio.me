import { Effect, Exit } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { classifyUpstreamCause, externalCall, isFrameworkSignal } from "@/lib/effect/external";
import { DbFailed, type UpstreamDetails } from "@/lib/effect/failures";

function dbFailed(details: UpstreamDetails) {
  return new DbFailed(details);
}

describe("externalCall", () => {
  it("returns the value of a successful call", async () => {
    const value = await Effect.runPromise(
      externalCall({
        operation: "test.ok",
        timeoutMs: 1_000,
        run: async () => 42,
        fail: dbFailed,
      }),
    );

    expect(value).toBe(42);
  });

  it("fails with a timeout kind and aborts the signal when the call outlives its limit", async () => {
    let received: AbortSignal | undefined;

    const failure = await Effect.runPromise(
      Effect.flip(
        externalCall({
          operation: "test.slow",
          timeoutMs: 20,
          run: (signal) => {
            received = signal;

            return new Promise<never>(() => {});
          },
          fail: dbFailed,
        }),
      ),
    );

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ kind: "timeout", operation: "test.slow" });
    expect(received?.aborted).toBe(true);
  });

  it("wraps a rejection in the dependency's own tagged error with a scrubbed message", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        externalCall({
          operation: "test.reject",
          timeoutMs: 1_000,
          run: async () => {
            throw new Error("upstream said no for person@example.com");
          },
          fail: dbFailed,
        }),
      ),
    );

    expect(failure).toBeInstanceOf(DbFailed);
    expect(failure).toMatchObject({ kind: "unavailable" });
    expect(failure.message).not.toContain("person@example.com");
  });

  it("turns a thrown framework signal into a defect instead of a typed failure", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;307;",
    });

    const exit = await Effect.runPromiseExit(
      externalCall({
        operation: "test.redirect",
        timeoutMs: 1_000,
        run: async () => {
          throw redirect;
        },
        fail: dbFailed,
      }),
    );

    expect(Exit.isFailure(exit) && exit.cause.reasons.map((r) => r._tag)).toEqual(["Die"]);
  });
});

describe("classifyUpstreamCause", () => {
  it.each([
    [Object.assign(new Error("x"), { name: "AbortError" }), "timeout"],
    [Object.assign(new Error("x"), { name: "TimeoutError" }), "timeout"],
    [{ status: 503 }, "unavailable"],
    [{ status: 429 }, "unavailable"],
    [{ status: 404 }, "rejected"],
    [{ status: 400 }, "rejected"],
    [new TypeError("fetch failed"), "unavailable"],
  ])("classifies %o as %s", (cause, kind) => {
    expect(classifyUpstreamCause(cause)).toBe(kind);
  });
});

describe("isFrameworkSignal", () => {
  it.each([
    "NEXT_REDIRECT;push;/x;307;",
    "NEXT_NOT_FOUND",
    "NEXT_HTTP_ERROR_FALLBACK;403",
    "DYNAMIC_SERVER_USAGE",
    "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  ])("recognizes digest %s", (digest) => {
    expect(isFrameworkSignal(Object.assign(new Error("x"), { digest }))).toBe(true);
  });

  it("ignores ordinary errors and unrelated digests", () => {
    expect(isFrameworkSignal(new Error("x"))).toBe(false);
    expect(isFrameworkSignal(Object.assign(new Error("x"), { digest: "123" }))).toBe(false);
  });
});
