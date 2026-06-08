import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const env = {
  UMAMI_API_URL: "https://umami.example",
  UMAMI_USERNAME: "avery",
  UMAMI_PASSWORD: "secret",
} as CloudflareEnv;

async function loadClient() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "site_123";
  return import("@/lib/umami/client");
}

describe("Umami analytics client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  });

  it("authenticates once and sends filtered stats, pageview, and metric requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
      const url = String(input);
      if (url.endsWith("/api/auth/login")) {
        expect(init?.method).toBe("POST");
        // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
        expect(JSON.parse(String(init?.body))).toEqual({
          username: "avery",
          password: "secret",
        });
        return Response.json({ token: "token-1" });
      }
      if (url.includes("/stats?")) {
        return Response.json({
          pageviews: 12,
          visitors: 4,
          visits: 5,
          bounces: 1,
          totaltime: 60,
          comparison: {
            pageviews: 1,
            visitors: 2,
            visits: 3,
            bounces: 4,
            totaltime: 5,
          },
        });
      }
      if (url.includes("/pageviews?")) {
        return Response.json({
          pageviews: [{ x: "2026-05-20", y: 8 }],
          sessions: [{ x: "2026-05-20", y: 3 }],
        });
      }
      return Response.json([{ x: "linkedin.com", y: 2 }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getMetrics, getPageviews, getStats } = await loadClient();

    await expect(getStats(env, { startAt: 1, endAt: 2, path: "/@avery" })).resolves.toMatchObject({
      pageviews: 12,
      visitors: 4,
    });
    await expect(
      getPageviews(env, {
        startAt: 3,
        endAt: 4,
        unit: "day",
        timezone: "America/Phoenix",
        path: "/@avery",
      }),
    ).resolves.toMatchObject({ pageviews: [{ x: "2026-05-20", y: 8 }] });
    await expect(
      getMetrics(env, {
        startAt: 5,
        endAt: 6,
        type: "referrer",
        unit: "day",
        timezone: "America/Phoenix",
        path: "/@avery",
        limit: 5,
      }),
    ).resolves.toEqual([{ x: "linkedin.com", y: 2 }]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://umami.example/api/websites/site_123/stats?startAt=1&endAt=2&path=%2F%40avery",
    );
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    expect(String(fetchMock.mock.calls[2][0])).toContain("unit=day");
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    expect(String(fetchMock.mock.calls[2][0])).toContain("timezone=America%2FPhoenix");
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    expect(String(fetchMock.mock.calls[3][0])).toContain("limit=5");
    // eslint-disable-next-line typescript/unbound-method -- vitest mock assertion
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ Authorization: "Bearer token-1" });
  });

  it("clears the cached token and retries once after an API 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "expired" }))
      .mockResolvedValueOnce(
        new Response("unauthorized", { status: 401, statusText: "Unauthorized" }),
      )
      .mockResolvedValueOnce(Response.json({ token: "fresh" }))
      .mockResolvedValueOnce(Response.json([{ x: "US", y: 7 }]));
    vi.stubGlobal("fetch", fetchMock);

    const { getMetrics } = await loadClient();

    await expect(
      getMetrics(env, {
        startAt: 1,
        endAt: 2,
        type: "country",
        unit: "day",
        timezone: "UTC",
      }),
    ).resolves.toEqual([{ x: "US", y: 7 }]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ Authorization: "Bearer expired" });
    expect(fetchMock.mock.calls[3][1]?.headers).toEqual({ Authorization: "Bearer fresh" });
  });

  it("throws clear errors for failed authentication and non-auth API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 403, statusText: "Forbidden" })),
    );
    const authClient = await loadClient();

    await expect(authClient.getUmamiToken(env)).rejects.toThrow("Umami auth failed: 403 Forbidden");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ token: "token" }))
        .mockResolvedValueOnce(new Response("boom", { status: 502, statusText: "Bad Gateway" })),
    );
    const apiClient = await loadClient();

    await expect(apiClient.getStats(env, { startAt: 1, endAt: 2 })).rejects.toThrow(
      "Umami API error: 502 Bad Gateway",
    );
  });
});
