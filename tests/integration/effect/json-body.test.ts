import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { runRoute } from "@/lib/effect/edges";
import { readJsonBody } from "@/lib/effect/json-body";
import { logLines } from "../../helpers/log-lines";

const schema = z.object({ name: z.string() });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readJsonBody", () => {
  it("logs the cause of a body that fails mid-read without leaking it to the visitor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("body stream broke"));
      },
    });

    const request = new Request("https://clickfolio.me/api/thing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // @ts-expect-error duplex is required for streamed request bodies and missing from lib.dom.
      duplex: "half",
    });

    const response = await runRoute(
      request,
      readJsonBody(request, schema, "invalid body").pipe(
        Effect.map(() => new Response(null, { status: 200 })),
      ),
      Layer.empty,
    );

    const responseBody = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(responseBody).toContain("Could not read the request body");
    expect(responseBody).not.toContain("body stream broke");

    expect(logLines(warn)).toContainEqual(
      expect.objectContaining({ failure: "InvalidInput", "error.message": "body stream broke" }),
    );
  });

  it("answers 413 for a streamed body past the limit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const chunk = new Uint8Array(1024).fill(0x20);

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });

    const request = new Request("https://clickfolio.me/api/thing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // @ts-expect-error duplex is required for streamed request bodies and missing from lib.dom.
      duplex: "half",
    });

    const response = await runRoute(
      request,
      readJsonBody(request, schema, "invalid body").pipe(
        Effect.map(() => new Response(null, { status: 200 })),
      ),
      Layer.empty,
    );

    expect(response.status).toBe(413);
  });
});
