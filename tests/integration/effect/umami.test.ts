import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";
import { runRoute } from "@/lib/effect/edges";
import { logLines } from "../../helpers/log-lines";

// SAFETY: the Umami client reads only these three env fields.
const env = {
  UMAMI_API_URL: "https://umami.invalid-host.test",
  UMAMI_USERNAME: "admin-user",
  UMAMI_PASSWORD: "admin-password",
} as CloudflareEnv;

const WINDOW = { startAt: 1, endAt: 2 };

const STATS = { pageviews: 10, visitors: 4, visits: 5, bounces: 1, totaltime: 99 };

function json(body: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {}),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

// The token cache lives at module scope on purpose, so each test gets a fresh module.
async function freshUmami() {
  vi.resetModules();

  const { Umami } = await import("@/lib/effect/services/umami");

  return Umami;
}

async function stats() {
  const Umami = await freshUmami();

  return Effect.runPromise(
    Effect.provide(
      Umami.use((umami) => umami.getStats(WINDOW)),
      Umami.layer(env),
    ),
  );
}

async function statsFailure() {
  const Umami = await freshUmami();

  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        Umami.use((umami) => umami.getStats(WINDOW)),
        Umami.layer(env),
      ),
    ),
  );
}

function isLogin(url: string): boolean {
  return url.endsWith("/api/auth/login");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "site-id-123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Umami service", () => {
  it("logs in once, then sends the bearer token and validates the stats", async () => {
    const fetchMock = stubFetch((url) =>
      isLogin(url) ? json({ token: "tok-1" }) : json({ ...STATS, comparison: { pageviews: 8 } }),
    );

    const result = await stats();

    expect(result).toMatchObject({ pageviews: 10, visitors: 4, comparison: { pageviews: 8 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ Authorization: "Bearer tok-1" });
    expect(fetchMock.mock.calls[1][0]).toContain("/api/websites/site-id-123/stats?");
  });

  it("reads null metric labels (direct referrers) as empty strings", async () => {
    stubFetch((url) =>
      isLogin(url)
        ? json({ token: "tok-1" })
        : json([
            { x: null, y: 3 },
            { x: "/@a", y: 2 },
          ]),
    );

    const Umami = await freshUmami();

    const rows = await Effect.runPromise(
      Effect.provide(
        Umami.use((umami) =>
          umami.getMetrics({ ...WINDOW, type: "referrer", unit: "day", timezone: "UTC" }),
        ),
        Umami.layer(env),
      ),
    );

    expect(rows).toEqual([
      { x: "", y: 3 },
      { x: "/@a", y: 2 },
    ]);
  });

  it("logs in again once after a 401 and then succeeds", async () => {
    let logins = 0;
    let gets = 0;

    const fetchMock = stubFetch((url) => {
      if (isLogin(url)) {
        logins += 1;

        return json({ token: `tok-${logins}` });
      }

      gets += 1;

      return gets === 1 ? json({}, 401) : json(STATS);
    });

    await stats();

    expect(logins).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]?.headers).toEqual({ Authorization: "Bearer tok-2" });
  });

  it("gives up after the second 401 as a rejected upstream", async () => {
    stubFetch((url) => (isLogin(url) ? json({ token: "tok" }) : json({}, 401)));

    const failure = await statsFailure();

    expect(failure).toMatchObject({ host: "umami", kind: "rejected", operation: "umami.stats" });
  });

  it("maps a 5xx to unavailable", async () => {
    stubFetch((url) => (isLogin(url) ? json({ token: "tok" }) : json({}, 503)));

    expect(await statsFailure()).toMatchObject({ kind: "unavailable" });
  });

  it("maps a wrong-shaped body to invalid-response", async () => {
    stubFetch((url) => (isLogin(url) ? json({ token: "tok" }) : json({ pageviews: { value: 3 } })));

    expect(await statsFailure()).toMatchObject({ kind: "invalid-response" });
  });

  it("maps a body that is not JSON to invalid-response", async () => {
    stubFetch((url) =>
      isLogin(url) ? json({ token: "tok" }) : new Response("<html>oops</html>", { status: 200 }),
    );

    expect(await statsFailure()).toMatchObject({ kind: "invalid-response" });
  });

  it("keeps the response body out of the failure when it is not JSON", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    stubFetch((url) =>
      isLogin(url)
        ? json({ token: "tok" })
        : new Response("<html>umami.invalid-host.test secret-body</html>", { status: 200 }),
    );

    const Umami = await freshUmami();

    await runRoute(
      new Request("https://clickfolio.me/api/admin/analytics"),
      Umami.use((umami) => umami.getStats(WINDOW)).pipe(Effect.map(() => Response.json({}))),
      Umami.layer(env),
    );

    const logged = JSON.stringify(logLines(error));

    expect(logged).toContain("invalid-response");
    expect(logged).not.toContain("secret-body");
    expect(logged).not.toContain("invalid-host.test");
  });

  it("rejects a login without a token and does not cache anything", async () => {
    let logins = 0;

    const fetchMock = stubFetch((url) => {
      if (isLogin(url)) {
        logins += 1;

        return logins === 1
          ? json({ requiresTwoFactor: true, partialToken: "p" })
          : json({ token: "ok" });
      }

      return json(STATS);
    });

    const Umami = await freshUmami();

    const program = Effect.provide(
      Umami.use((umami) => umami.getStats(WINDOW)),
      Umami.layer(env),
    );

    expect(await Effect.runPromise(Effect.flip(program))).toMatchObject({
      kind: "invalid-response",
    });
    expect(await Effect.runPromise(program)).toMatchObject({ pageviews: 10 });
    expect(logins).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps a transport abort to timeout", async () => {
    stubFetch(() => {
      throw new DOMException("The operation was aborted", "TimeoutError");
    });

    expect(await statsFailure()).toMatchObject({ kind: "timeout" });
  });

  it("stops waiting after the outer timeout when the server never answers", async () => {
    vi.useFakeTimers();
    stubFetch(() => new Promise<Response>(() => {}));

    const pending = statsFailure();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toMatchObject({ kind: "timeout", operation: "umami.stats" });
  });

  it("does not join a login that outlived its own timeout", async () => {
    vi.useFakeTimers();

    let logins = 0;

    stubFetch((url) => {
      if (isLogin(url)) {
        logins += 1;

        return logins === 1 ? new Promise<Response>(() => {}) : json({ token: "tok" });
      }

      return json(STATS);
    });

    const Umami = await freshUmami();

    const program = Effect.provide(
      Umami.use((umami) => umami.getStats(WINDOW)),
      Umami.layer(env),
    );

    const first = Effect.runPromise(Effect.flip(program));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(await first).toMatchObject({ kind: "timeout" });

    expect(await Effect.runPromise(program)).toMatchObject({ pageviews: 10 });
    expect(logins).toBe(2);
  });

  it("shares one login between concurrent calls", async () => {
    const fetchMock = stubFetch((url) => (isLogin(url) ? json({ token: "tok" }) : json(STATS)));

    const Umami = await freshUmami();

    await Effect.runPromise(
      Effect.provide(
        Effect.all(
          [1, 2, 3].map(() => Umami.use((umami) => umami.getStats(WINDOW))),
          { concurrency: "unbounded" },
        ),
        Umami.layer(env),
      ),
    );

    expect(fetchMock.mock.calls.filter(([url]) => isLogin(String(url)))).toHaveLength(1);
  });
});

describe("Umami failures at the route edge", () => {
  it("answers 502 and logs neither the host, the website id nor the token", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    stubFetch((url) =>
      isLogin(url) ? json({ token: "secret-token-value" }) : json({ pageviews: "many" }),
    );

    const Umami = await freshUmami();

    const response = await runRoute(
      new Request("https://clickfolio.me/api/admin/analytics"),
      Umami.use((umami) => umami.getStats(WINDOW)).pipe(Effect.map(() => Response.json({}))),
      Umami.layer(env),
    );

    const body = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(body)).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });

    const logged = JSON.stringify(logLines(error));

    expect(logged).toContain("umami.stats");
    expect(logged).toContain("invalid-response");

    for (const secret of [
      "invalid-host.test",
      "site-id-123",
      "secret-token-value",
      "admin-password",
    ]) {
      expect(logged).not.toContain(secret);
      expect(body).not.toContain(secret);
    }
  });

  it("scrubs the URL out of a failed fetch", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    stubFetch(() => {
      throw new TypeError(
        "Failed to parse URL from https://umami.invalid-host.test/api/auth/login",
      );
    });

    const Umami = await freshUmami();

    const response = await runRoute(
      new Request("https://clickfolio.me/api/admin/analytics"),
      Umami.use((umami) => umami.getStats(WINDOW)).pipe(Effect.map(() => Response.json({}))),
      Umami.layer(env),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(logLines(error))).not.toContain("invalid-host.test");
  });
});
