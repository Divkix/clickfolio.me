import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { DurableObjectFailed } from "@/lib/effect/failures";
import {
  statusNoticeSchema,
  StatusChannel,
  type StatusNamespace,
} from "@/lib/effect/services/status-channel";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function namespaceWith(fetchStub: Fetch) {
  const idFromName = vi.fn((name: string) => `id:${name}`);

  const namespace: StatusNamespace<string> = {
    idFromName,
    get: () => ({ fetch: fetchStub }),
  };

  return { namespace, idFromName };
}

function notify(layer: ReturnType<typeof StatusChannel.layerFrom>) {
  return Effect.runPromiseExit(
    Effect.provide(
      StatusChannel.use((channel) => channel.notify("resume-1", { status: "failed", version: 5 })),
      layer,
    ),
  );
}

async function failureOf(layer: ReturnType<typeof StatusChannel.layerFrom>) {
  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        StatusChannel.use((channel) => channel.notify("resume-1", { status: "failed" })),
        layer,
      ),
    ),
  );
}

describe("StatusChannel", () => {
  it("POSTs the notice to the object named by the resume id", async () => {
    const fetchStub = vi.fn<Fetch>(async () => new Response("OK"));
    const { namespace, idFromName } = namespaceWith(fetchStub);

    const exit = await notify(StatusChannel.layerFrom(namespace));

    expect(exit._tag).toBe("Success");
    expect(idFromName).toHaveBeenCalledWith("resume-1");
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe("https://do-internal/notify");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ status: "failed", version: 5 }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("does nothing without a bound namespace", async () => {
    const exit = await notify(StatusChannel.layerFrom(undefined));

    expect(exit._tag).toBe("Success");
  });

  it.each([
    { status: 400, kind: "rejected" },
    { status: 500, kind: "unavailable" },
  ])("fails with DurableObjectFailed (%j) when the object answers non-2xx", async (answer) => {
    const { namespace } = namespaceWith(async () => new Response("no", { status: answer.status }));

    const failure = await failureOf(StatusChannel.layerFrom(namespace));

    expect(failure).toBeInstanceOf(DurableObjectFailed);
    expect(failure).toMatchObject({ kind: answer.kind, operation: "status.notify" });
  });

  it("fails when the stub throws", async () => {
    const { namespace } = namespaceWith(async () => {
      throw new Error("Durable Object reset");
    });

    const failure = await failureOf(StatusChannel.layerFrom(namespace));

    expect(failure).toMatchObject({ kind: "unavailable", message: "Durable Object reset" });
  });

  it("times out, aborts the request and does not retry", async () => {
    let received: AbortSignal | null | undefined;

    const fetchStub = vi.fn<Fetch>((_input, init) => {
      received = init?.signal;

      return new Promise<Response>(() => {});
    });

    const { namespace } = namespaceWith(fetchStub);
    const failure = await failureOf(StatusChannel.layerFrom(namespace, 20));

    expect(failure).toMatchObject({ kind: "timeout" });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(received?.aborted).toBe(true);
  });
});

describe("statusNoticeSchema", () => {
  it("accepts a status with optional error and version", () => {
    expect(statusNoticeSchema.safeParse({ status: "failed", error: "x", version: 1 }).success).toBe(
      true,
    );
    expect(statusNoticeSchema.safeParse({ status: "queued" }).success).toBe(true);
  });

  it.each([
    {},
    { status: "bogus" },
    { status: 3 },
    { status: "failed", error: 3 },
    { status: "failed", error: "x".repeat(2_001) },
    { status: "failed", version: Number.NaN },
    { status: "failed", version: "1" },
  ])("rejects %j", (body) => {
    expect(statusNoticeSchema.safeParse(body).success).toBe(false);
  });
});
