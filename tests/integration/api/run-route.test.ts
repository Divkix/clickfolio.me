import { Effect } from "effect";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  InvalidInput,
  PayloadTooLarge,
  RateLimited,
  RateLimitUnavailable,
  type HttpFailure,
} from "@/lib/api/errors";
import { decodeJsonBody, decodeWith, runRoute } from "@/lib/api/route";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/security-headers";
import { logLines } from "../../helpers/log-lines";

const bodySchema = z.object({ resume_id: z.string().min(1) });

const decodeOptions = { message: "resume_id is required", code: "BAD_REQUEST" } as const;

function jsonRequest(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request("https://clickfolio.test/api/example", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

function echoBody(request: Request): Promise<Response> {
  return runRoute(
    request,
    Effect.gen(function* () {
      const body = yield* decodeJsonBody(request, bodySchema, { ...decodeOptions, maxBytes: 64 });

      return createSuccessResponse({ received: body.resume_id });
    }),
  );
}

let infoSpy: ReturnType<typeof vi.spyOn>;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runRoute", () => {
  it("returns the program's Response on success", async () => {
    const response = await echoBody(jsonRequest(JSON.stringify({ resume_id: "r1" })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: "r1" });
  });

  it("maps a typed failure to the error body and logs it at the failure's level", async () => {
    const request = jsonRequest(null);

    const response = await runRoute(
      request,
      Effect.fail(new InvalidInput({ message: "Bad input", errorCode: "BAD_REQUEST" })),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ error: "Bad input", code: "BAD_REQUEST" });
    expect(logLines(infoSpy)).toEqual([
      expect.objectContaining({
        level: "info",
        msg: "API route failure",
        errorType: "InvalidInput",
        code: "BAD_REQUEST",
        status: 400,
        path: "/api/example",
        method: "POST",
        "error.message": "Bad input",
      }),
    ]);
  });

  it("logs a failure's cause but never sends it", async () => {
    const cause = new Error("stream reset by peer");

    const response = await runRoute(
      jsonRequest(null),
      Effect.fail(new PayloadTooLarge({ message: "Too big", cause })),
    );

    const body = await response.json();

    expect(response.status).toBe(413);
    expect(JSON.stringify(body)).not.toContain("stream reset");
    expect(logLines(infoSpy)[0]).toMatchObject({ "error.message": "stream reset by peer" });
  });

  it("turns a defect into a generic 500 and logs it as unhandled", async () => {
    const response = await runRoute(
      jsonRequest(null),
      Effect.promise(() => Promise.reject(new Error("db exploded"))),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "An unexpected error occurred. Please try again.",
      code: "INTERNAL_ERROR",
    });
    expect(logLines(errorSpy)).toEqual([
      expect.objectContaining({
        msg: "Unhandled API route error",
        "error.message": "db exploded",
        path: "/api/example",
      }),
    ]);
  });

  it("turns an interruption into a generic 500", async () => {
    const response = await runRoute(jsonRequest(null), Effect.interrupt);

    expect(response.status).toBe(500);
    expect(logLines(errorSpy)[0]).toMatchObject({ msg: "Unhandled API route error" });
  });
});

describe("decodeJsonBody", () => {
  it.each([
    ["no body", null],
    ["a JSON null body", "null"],
    ["a body missing the field", "{}"],
    ["a body with the wrong type", JSON.stringify({ resume_id: 7 })],
  ])("answers 400 with Zod issues for %s", async (_label, body) => {
    const response = await echoBody(jsonRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "resume_id is required",
      code: "BAD_REQUEST",
      details: [expect.objectContaining({ path: expect.any(Array) })],
    });
  });

  it.each([
    ["an empty body", ""],
    ["malformed JSON", "{resume_id:"],
  ])("answers 400 for %s", async (_label, body) => {
    const response = await echoBody(jsonRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON in request body",
      code: "BAD_REQUEST",
    });
  });

  it("answers 413 when Content-Length is over the cap", async () => {
    const response = await echoBody(jsonRequest("{}", { "Content-Length": "65" }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("answers 413 when a body without Content-Length passes the cap", async () => {
    const request = jsonRequest(JSON.stringify({ resume_id: "x".repeat(100) }));

    expect(request.headers.get("Content-Length")).toBeNull();

    const response = await echoBody(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Request body too large"),
    });
  });

  it("answers 400 and logs the cause when the body stream fails mid-read", async () => {
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("stream reset"));
        },
      }),
      duplex: "half",
    };

    const response = await echoBody(new Request("https://clickfolio.test/api/example", init));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
      code: "BAD_REQUEST",
    });
    expect(logLines(infoSpy)).toEqual([
      expect.objectContaining({
        level: "info",
        errorType: "InvalidInput",
        "error.message": "stream reset",
      }),
    ]);
    expect(logLines(errorSpy)).toEqual([]);
  });
});

describe("decodeWith", () => {
  it("defaults to VALIDATION_ERROR and keeps the issue paths", async () => {
    const response = await runRoute(
      jsonRequest(null),
      decodeWith(bodySchema, { resume_id: "" }, { message: "Invalid data" }).pipe(
        Effect.as(createSuccessResponse({})),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid data",
      code: "VALIDATION_ERROR",
      details: [expect.objectContaining({ path: ["resume_id"] })],
    });
  });
});

describe("HttpFailure classes", () => {
  const cases: Array<[string, HttpFailure, number, string, boolean, string]> = [
    ["InvalidInput", new InvalidInput({ message: "m" }), 400, "VALIDATION_ERROR", false, "info"],
    [
      "InvalidInput (BAD_REQUEST)",
      new InvalidInput({ message: "m", errorCode: "BAD_REQUEST" }),
      400,
      "BAD_REQUEST",
      false,
      "info",
    ],
    ["PayloadTooLarge", new PayloadTooLarge({ message: "m" }), 413, "BAD_REQUEST", false, "info"],
    ["RateLimited", new RateLimited({ message: "m" }), 429, "RATE_LIMIT_EXCEEDED", true, "info"],
    [
      "RateLimitUnavailable",
      new RateLimitUnavailable({ message: "m" }),
      503,
      "RATE_LIMIT_UNAVAILABLE",
      true,
      "warn",
    ],
  ];

  it.each(cases)("%s maps to status, code, retryable and log level", (...row) => {
    const [, failure, status, code, retryable, logLevel] = row;

    expect(failure).toMatchObject({ httpStatus: status, code, retryable, logLevel });
    expect(failure.userMessage).toBe("m");
  });
});

describe("createErrorResponse", () => {
  it("adds extra headers without dropping the security headers", () => {
    const response = createErrorResponse("Busy", "INTERNAL_ERROR", 503, undefined, {
      "Retry-After": "60",
    });

    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
