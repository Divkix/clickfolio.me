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

function withCountry(request: Request, country: string | undefined): Request {
  Object.defineProperty(request, "cf", { value: { country } });

  return request;
}

function otlpTraces(attributes: unknown[] = []) {
  return {
    resourceSpans: [
      { resource: { attributes }, scopeSpans: [] },
      { resource: { attributes: [] }, scopeSpans: [] },
    ],
  };
}

async function forwardedBody(request: Request): Promise<Uint8Array> {
  const { ctx, settle } = makeCtx();
  expect((await handleOtelProxy(request, ENV, ctx)).status).toBe(202);
  await settle();
  const [, init] = fetchMock.mock.calls[0];

  // SAFETY: handleOtelProxy always forwards the body as a Uint8Array.
  return init.body as Uint8Array;
}

async function forwardedText(request: Request): Promise<string> {
  return new TextDecoder().decode(await forwardedBody(request));
}

const COUNTRY = { key: "geo.country.iso_code", value: { stringValue: "DE" } };

beforeEach(() => {
  fetchMock.mockClear();
  mocks.log.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
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
      "error",
      "otel proxy upstream failed",
      expect.objectContaining({ "otel.signal": "traces", "error.message": "collector down" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(ENV.OTEL_BROWSER_INGEST_KEY);
  });

  it("logs a collector rejection by status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad key", { status: 401 }));
    const { ctx, settle } = makeCtx();
    await handleOtelProxy(post("/otel/v1/traces"), ENV, ctx);
    await settle();

    expect(mocks.log).toHaveBeenCalledWith("error", "otel proxy upstream rejected", {
      status: 401,
      "otel.signal": "traces",
    });
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(ENV.OTEL_BROWSER_INGEST_KEY);
  });

  it("gives up on a collector that never answers and aborts the request", async () => {
    vi.useFakeTimers();
    let aborted = false;

    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise<Response>(() => {
          init.signal?.addEventListener("abort", () => {
            aborted = true;
          });
        }),
    );

    const { ctx, settle } = makeCtx();
    const response = await handleOtelProxy(post("/otel/v1/traces"), ENV, ctx);
    expect(response.status).toBe(202);

    const settled = settle();
    await vi.advanceTimersByTimeAsync(10_001);
    await settled;

    expect(aborted).toBe(true);

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "otel proxy upstream failed",
      expect.objectContaining({ "otel.signal": "traces", kind: "timeout" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(ENV.OTEL_BROWSER_INGEST_KEY);
  });

  it("logs a collector outage (5xx) as a rejection with its status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    const { ctx, settle } = makeCtx();
    await handleOtelProxy(post("/otel/v1/logs"), ENV, ctx);
    await settle();

    expect(mocks.log).toHaveBeenCalledWith("error", "otel proxy upstream rejected", {
      status: 503,
      "otel.signal": "logs",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe("visitor country", () => {
    it("adds the country to every resource of a JSON trace export", async () => {
      const service = { key: "service.name", value: { stringValue: "web" } };

      const body = await forwardedText(
        withCountry(post("/otel/v1/traces", { body: JSON.stringify(otlpTraces([service])) }), "DE"),
      );

      expect(JSON.parse(body)).toEqual({
        resourceSpans: [
          { resource: { attributes: [service, COUNTRY] }, scopeSpans: [] },
          { resource: { attributes: [COUNTRY] }, scopeSpans: [] },
        ],
      });
    });

    it("adds the country to log resources, creating missing attribute lists", async () => {
      const body = await forwardedText(
        withCountry(
          post("/otel/v1/logs", {
            body: JSON.stringify({ resourceLogs: [{ scopeLogs: [] }, { resource: {} }] }),
          }),
          "DE",
        ),
      );

      expect(JSON.parse(body)).toEqual({
        resourceLogs: [
          { resource: { attributes: [COUNTRY] }, scopeLogs: [] },
          { resource: { attributes: [COUNTRY] } },
        ],
      });
    });

    it("replaces a client-sent country", async () => {
      const spoofed = { key: "geo.country.iso_code", value: { stringValue: "US" } };

      const body = await forwardedText(
        withCountry(post("/otel/v1/traces", { body: JSON.stringify(otlpTraces([spoofed])) }), "DE"),
      );

      expect(JSON.parse(body)).toEqual({
        resourceSpans: [
          { resource: { attributes: [COUNTRY] }, scopeSpans: [] },
          { resource: { attributes: [COUNTRY] }, scopeSpans: [] },
        ],
      });
    });

    it.each([undefined, "T1", "XX", "not-a-code"])(
      "leaves the body untouched when the country is %s",
      async (country) => {
        const raw = JSON.stringify(otlpTraces());

        const body = await forwardedText(
          withCountry(post("/otel/v1/traces", { body: raw }), country),
        );

        expect(body).toBe(raw);
      },
    );

    it("tags JSON sent with a charset parameter", async () => {
      const body = await forwardedText(
        withCountry(
          post("/otel/v1/traces", {
            headers: { "content-type": "application/json; charset=utf-8" },
            body: JSON.stringify(otlpTraces()),
          }),
          "DE",
        ),
      );

      expect(JSON.parse(body).resourceSpans[0].resource.attributes).toEqual([COUNTRY]);
    });

    it("leaves the body untouched when the request has no cf object", async () => {
      const raw = JSON.stringify(otlpTraces());

      expect(await forwardedText(post("/otel/v1/traces", { body: raw }))).toBe(raw);
    });

    it.each([
      ["protobuf", { "content-type": "application/x-protobuf" }, JSON.stringify(otlpTraces())],
      [
        "compressed JSON",
        { "content-type": "application/json", "content-encoding": "gzip" },
        JSON.stringify(otlpTraces()),
      ],
      ["unparseable JSON", { "content-type": "application/json" }, "{not json"],
      ["JSON without resources", { "content-type": "application/json" }, '{"resourceSpans":[]}'],
      ["a JSON array", { "content-type": "application/json" }, "[]"],
      [
        "an export with a malformed attribute",
        { "content-type": "application/json" },
        JSON.stringify(otlpTraces([{ value: { stringValue: "no key" } }])),
      ],
    ])("passes %s through byte for byte", async (_label, headers, raw) => {
      const sent = new TextEncoder().encode(raw);

      const body = await forwardedBody(
        withCountry(post("/otel/v1/traces", { headers, body: sent }), "DE"),
      );

      expect(body).toEqual(sent);
    });
  });
});
