import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { HttpUpstreamFailed } from "@/lib/effect/failures";
import { AlertWebhook, type WebhookFetch } from "@/lib/effect/services/alert-webhook";

const URL_WITH_SECRET = "https://hooks.example.com/services/T000/B000/SECRETTOKEN";

function post(layer: ReturnType<typeof AlertWebhook.layerFrom>) {
  return Effect.runPromiseExit(
    Effect.provide(
      AlertWebhook.use((webhook) => webhook.post({ text: "hello" })),
      layer,
    ),
  );
}

async function failureOf(layer: ReturnType<typeof AlertWebhook.layerFrom>) {
  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        AlertWebhook.use((webhook) => webhook.post({ text: "hello" })),
        layer,
      ),
    ),
  );
}

describe("AlertWebhook", () => {
  it("POSTs the JSON body with the abort signal", async () => {
    const send = vi.fn<WebhookFetch>(async () => new Response("ok"));

    const exit = await post(AlertWebhook.layerFrom(URL_WITH_SECRET, send));

    expect(exit._tag).toBe("Success");
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe(URL_WITH_SECRET);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does nothing when no URL is configured", async () => {
    const send = vi.fn<WebhookFetch>();

    await post(AlertWebhook.layerFrom(undefined, send));

    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    { status: 500, kind: "unavailable" },
    { status: 429, kind: "unavailable" },
    { status: 404, kind: "rejected" },
  ])("classifies a $status answer as $kind", async ({ status, kind }) => {
    const failure = await failureOf(
      AlertWebhook.layerFrom(URL_WITH_SECRET, async () => new Response("no", { status })),
    );

    expect(failure).toBeInstanceOf(HttpUpstreamFailed);
    expect(failure).toMatchObject({ kind, host: "alert-webhook", operation: "alert.webhook" });
    expect(failure.message).toContain(String(status));
  });

  it("never keeps the webhook URL, in the message, the cause or the stack", async () => {
    const failure = await failureOf(
      AlertWebhook.layerFrom(URL_WITH_SECRET, async () => {
        throw new Error(
          `fetch failed for ${URL_WITH_SECRET} (path /services/T000/B000/SECRETTOKEN)`,
        );
      }),
    );

    const kept = JSON.stringify([failure.message, failure.cause?.toString(), failure.cause]);

    expect(kept).not.toContain("SECRETTOKEN");
    expect(failure.message).toContain("[webhook]");
    expect(String(failure.cause instanceof Error ? failure.cause.stack : "")).not.toContain(
      "SECRETTOKEN",
    );
  });

  it("times out, aborts the request and does not retry", async () => {
    let received: AbortSignal | undefined;

    const send = vi.fn<WebhookFetch>((_url, init) => {
      received = init.signal ?? undefined;

      return new Promise<Response>(() => {});
    });

    const failure = await failureOf(AlertWebhook.layerFrom(URL_WITH_SECRET, send, 20));

    expect(failure).toMatchObject({ kind: "timeout" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(received?.aborted).toBe(true);
  });
});
