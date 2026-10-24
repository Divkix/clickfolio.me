import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { runBackground, runPage, runRoute } from "@/lib/effect/edges";
import { DbFailed, InvalidInput, NotFound, RateLimitUnavailable } from "@/lib/effect/failures";
import { logLines } from "../../helpers/log-lines";

const request = new Request("https://clickfolio.me/api/thing", { method: "POST" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runRoute", () => {
  it("returns the program's response", async () => {
    const response = await runRoute(
      request,
      Effect.succeed(Response.json({ ok: true })),
      Layer.empty,
    );

    expect(await response.json()).toEqual({ ok: true });
  });

  it("answers a client failure with its status, code and message", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await runRoute(
      request,
      Effect.fail(new NotFound({ message: "No such resume" })),
      Layer.empty,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No such resume", code: "NOT_FOUND" });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends Retry-After with a retryable refusal", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runRoute(
      request,
      Effect.fail(
        new RateLimitUnavailable({ message: "Try again shortly", retryAfterSeconds: 60 }),
      ),
      Layer.empty,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(logLines(error)[0]).toMatchObject({ level: "error", failure: "RateLimitUnavailable" });
  });

  it("hides the cause of an upstream failure from the body but logs it scrubbed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runRoute(
      request,
      Effect.fail(
        new DbFailed({
          operation: "profile.read",
          kind: "timeout",
          message: "profile.read timed out",
          cause: new Error("password=hunter2 for person@example.com"),
        }),
      ),
      Layer.empty,
    );

    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(504);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("profile.read");

    const [line] = logLines(error);

    expect(line).toMatchObject({
      failure: "DbFailed",
      operation: "profile.read",
      kind: "timeout",
      retryable: true,
    });
    expect(JSON.stringify(line)).not.toContain("person@example.com");
  });

  it("logs a client failure at warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await runRoute(request, Effect.fail(new InvalidInput({ message: "Bad body" })), Layer.empty);

    expect(logLines(warn)[0]).toMatchObject({
      level: "warn",
      failure: "InvalidInput",
      path: "/api/thing",
      "error.message": "Bad body",
    });
  });

  it("logs a timed-out call's message and flags that its outcome is unknown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runRoute(
      request,
      Effect.fail(
        new DbFailed({
          operation: "email.send",
          kind: "timeout",
          message: "email.send timed out after 8000ms",
        }),
      ),
      Layer.empty,
    );

    expect(response.status).toBe(504);
    expect(logLines(error)[0]).toMatchObject({
      failure: "DbFailed",
      operation: "email.send",
      kind: "timeout",
      retryable: true,
      outcome_unknown: true,
      "error.message": "email.send timed out after 8000ms",
    });
  });

  it("turns a defect into a logged generic 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runRoute(request, Effect.die(new Error("boom")), Layer.empty);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "INTERNAL_ERROR" });
    expect(logLines(error)[0]).toMatchObject({
      msg: "Unhandled API route error",
      path: "/api/thing",
    });
  });

  it("rethrows framework control flow instead of answering 500", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/;307;",
    });

    await expect(runRoute(request, Effect.die(redirect), Layer.empty)).rejects.toBe(redirect);
  });
});

describe("runPage", () => {
  it("returns the value", async () => {
    expect(await runPage(Effect.succeed("page data"), Layer.empty)).toBe("page data");
  });

  it("throws for a typed failure with the failure as cause", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new NotFound({ message: "No such page" });

    await expect(runPage(Effect.fail(failure), Layer.empty)).rejects.toMatchObject({
      message: "No such page",
      cause: failure,
    });
  });

  it("rethrows framework control flow with its identity", async () => {
    const notFound = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });

    await expect(runPage(Effect.die(notFound), Layer.empty)).rejects.toBe(notFound);
  });
});

describe("runBackground", () => {
  it("hands back the Exit so the caller decides what to ack or retry", async () => {
    const exit = await runBackground(Effect.fail("nope"), Layer.empty);

    expect(exit._tag).toBe("Failure");
  });
});
