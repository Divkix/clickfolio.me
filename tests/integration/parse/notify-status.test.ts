import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DurableObjectFailed } from "@/lib/effect/failures";
import { StatusChannel, type StatusNamespace } from "@/lib/effect/services/status-channel";
import {
  notifyStatus,
  notifyStatusBestEffort,
  notifyStatusChange,
  notifyStatusChangeBatch,
} from "@/lib/parse/notify-status";

const mocks = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function layerWith(fetchStub: Fetch) {
  const namespace: StatusNamespace<string> = {
    idFromName: (name) => name,
    get: () => ({ fetch: fetchStub }),
  };

  return StatusChannel.layerFrom(namespace);
}

function sentBody(fetchStub: ReturnType<typeof vi.fn<Fetch>>) {
  return JSON.parse(String(fetchStub.mock.calls[0][1]?.body));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("notifyStatus", () => {
  it("pushes the status with a version stamp and no error key when there is none", async () => {
    const fetchStub = vi.fn<Fetch>(async () => new Response("OK"));

    await Effect.runPromise(
      Effect.provide(
        notifyStatus({ resumeId: "resume-1", status: "processing" }),
        layerWith(fetchStub),
      ),
    );

    const body = sentBody(fetchStub);
    expect(body.status).toBe("processing");
    expect(Number.isFinite(body.version)).toBe(true);
    expect("error" in body).toBe(false);
  });

  it("cuts a long error to the size the Durable Object accepts", async () => {
    const fetchStub = vi.fn<Fetch>(async () => new Response("OK"));

    await Effect.runPromise(
      Effect.provide(
        notifyStatus({ resumeId: "resume-1", status: "failed", error: "e".repeat(5_000) }),
        layerWith(fetchStub),
      ),
    );

    expect(sentBody(fetchStub).error).toHaveLength(2_000);
  });

  it("fails with DurableObjectFailed when the object rejects", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          notifyStatus({ resumeId: "resume-1", status: "failed" }),
          layerWith(async () => new Response("no", { status: 400 })),
        ),
      ),
    );

    expect(failure).toBeInstanceOf(DurableObjectFailed);
    expect(failure).toMatchObject({ kind: "rejected" });
  });
});

describe("notifyStatusBestEffort", () => {
  it("logs a failure without the resume's content and still succeeds", async () => {
    await Effect.runPromise(
      Effect.provide(
        notifyStatusBestEffort({ resumeId: "resume-1", status: "failed", error: "secret text" }),
        layerWith(async () => {
          throw new Error("object reset");
        }),
      ),
    );

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "notify-status: failed to notify DO for resume",
      expect.objectContaining({
        resumeId: "resume-1",
        failure: "DurableObjectFailed",
        operation: "status.notify",
        "error.message": "object reset",
      }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("secret text");
  });
});

describe("without a bound Durable Object", () => {
  it("notifyStatusChange and the batch resolve without logging", async () => {
    const env = { CLICKFOLIO_STATUS_DO: undefined };

    await expect(
      notifyStatusChange({ resumeId: "resume-1", status: "completed", env }),
    ).resolves.toBeUndefined();
    await expect(notifyStatusChangeBatch(["a", "b"], "completed", env)).resolves.toBeUndefined();
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
