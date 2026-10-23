import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

const { handleOtelProxy } = await import("@/lib/worker/otel-proxy");

const ENV = { OTEL_COLLECTOR_URL: "https://collector.test", OTEL_BROWSER_INGEST_KEY: "ingest-key" };

const fetchMock = vi.fn(
  async (_url: string, _init: RequestInit) => new Response(null, { status: 200 }),
);

function makeCtx() {
  const pending: Promise<void>[] = [];

  return {
    ctx: { waitUntil: (promise: Promise<void>) => void pending.push(promise) },
    settle: () => Promise.all(pending),
  };
}

function post(path: string, init: RequestInit = {}) {
  return new Request(`https://clickfolio.me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    ...init,
  });
}

beforeEach(() => {
  fetchMock.mockClear();
  mocks.log.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleOtelProxy", () => {
  it.each(["traces", "logs"])("forwards /otel/v1/%s with the server key only", async (signal) => {
    const { ctx, settle } = makeCtx();

    const response = await handleOtelProxy(
      post(`/otel/v1/${signal}`, {
        headers: {
          "content-type": "application/x-protobuf",
          "content-encoding": "gzip",
          authorization: "client-supplied",
          cookie: "__session=secret",
        },
      }),
      ENV,
      ctx,
    );

    expect(response.status).toBe(202);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(url).toBe(`https://collector.test/v1/${signal}`);
    expect(headers.get("authorization")).toBe("ingest-key");
    expect(headers.get("content-type")).toBe("application/x-protobuf");
    expect(headers.get("content-encoding")).toBe("gzip");
    expect(headers.get("cookie")).toBeNull();
  });

  it.each(["/otel", "/otel/v1/metrics", "/otel/v1/traces/extra"])(
    "rejects %s with 404",
    async (path) => {
      const { ctx } = makeCtx();
      expect((await handleOtelProxy(post(path), ENV, ctx)).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects non-POST methods with 405", async () => {
    const { ctx } = makeCtx();

    const response = await handleOtelProxy(
      new Request("https://clickfolio.me/otel/v1/traces"),
      ENV,
      ctx,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("rejects non-OTLP content types with 415", async () => {
    const { ctx } = makeCtx();

    const response = await handleOtelProxy(
      post("/otel/v1/logs", { headers: { "content-type": "text/plain" } }),
      ENV,
      ctx,
    );

    expect(response.status).toBe(415);
  });

  it("rejects bodies over 1 MB with 413, with or without Content-Length", async () => {
    const { ctx } = makeCtx();
    const big = new Uint8Array(1024 * 1024 + 1);

    const declared = await handleOtelProxy(post("/otel/v1/logs", { body: big }), ENV, ctx);

    const chunked = await handleOtelProxy(
      post("/otel/v1/logs", {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(big);
            controller.close();
          },
        }),
        // @ts-expect-error -- duplex is required by undici for stream bodies but missing from lib.dom RequestInit
        duplex: "half",
      }),
      ENV,
      ctx,
    );

    expect(declared.status).toBe(413);
    expect(chunked.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 when the client aborts mid-upload", async () => {
    const { ctx } = makeCtx();

    const response = await handleOtelProxy(
      post("/otel/v1/logs", {
        body: new ReadableStream({
          start(controller) {
            controller.error(new Error("client aborted"));
          },
        }),
        // @ts-expect-error -- duplex is required by undici for stream bodies but missing from lib.dom RequestInit
        duplex: "half",
      }),
      ENV,
      ctx,
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the ingest key", { ...ENV, OTEL_BROWSER_INGEST_KEY: "" }],
    ["the collector URL", { ...ENV, OTEL_COLLECTOR_URL: undefined }],
  ])("accepts and drops data while %s is unset", async (_label, env) => {
    const { ctx } = makeCtx();

    const response = await handleOtelProxy(post("/otel/v1/traces"), env, ctx);

    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs a collector failure without changing the response", async () => {
    fetchMock.mockRejectedValueOnce(new Error("collector down"));
    const { ctx, settle } = makeCtx();
    const response = await handleOtelProxy(post("/otel/v1/traces"), ENV, ctx);
    expect(response.status).toBe(202);
    await settle();

    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "otel proxy upstream failed",
      expect.objectContaining({ "error.message": "collector down" }),
    );
  });

  it("logs a collector rejection by status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad key", { status: 401 }));
    const { ctx, settle } = makeCtx();
    await handleOtelProxy(post("/otel/v1/traces"), ENV, ctx);
    await settle();

    expect(mocks.log).toHaveBeenCalledWith("warn", "otel proxy upstream rejected", { status: 401 });
  });
});
