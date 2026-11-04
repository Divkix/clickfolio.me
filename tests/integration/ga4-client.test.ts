import { inspect } from "node:util";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import type { JsonValue } from "@/lib/types/json";

const NOW = Date.UTC(2026, 0, 8, 12);
const WINDOW = { startAt: Date.UTC(2026, 0, 2), endAt: Date.UTC(2026, 0, 8, 23, 59) };
const PROPERTY = "123456789";
const EMAIL = "analytics-test@project.iam.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`;
const ACCESS_TOKEN = "test-access-token-not-a-real-credential";

const STATS: JsonValue = {
  dimensionHeaders: [{ name: "dateRange" }],
  metricHeaders: [{ name: "totalUsers" }, { name: "screenPageViews" }],
  rows: [
    {
      dimensionValues: [{ value: "date_range_1" }],
      metricValues: [{ value: "4" }, { value: "10" }],
    },
    {
      dimensionValues: [{ value: "date_range_0" }],
      metricValues: [{ value: "6" }, { value: "15" }],
    },
  ],
  rowCount: 2,
};

const reportRequestSchema = z.object({
  dimensions: z.array(z.object({ name: z.string() })),
  metrics: z.array(z.object({ name: z.string() })),
  dateRanges: z.array(z.object({ startDate: z.string(), endDate: z.string() })),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

let publicKey: CryptoKey;
let privateKeyPem: string;
let env: CloudflareEnv;

beforeAll(async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  publicKey = keys.publicKey;
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
});

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  // SAFETY: the GA4 client reads only its source, property and service-account fields.
  env = {
    ANALYTICS_SOURCE: "ga4",
    GA4_PROPERTY_ID: PROPERTY,
    GA4_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: "service_account",
      client_email: EMAIL,
      private_key: privateKeyPem,
      private_key_id: "test-key-id",
    }),
  } as CloudflareEnv;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function json(body: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function token(value = ACCESS_TOKEN): Response {
  return json({ access_token: value, token_type: "Bearer", expires_in: 3600 });
}

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init ?? {}),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

// A delayed import after resetModules gives each test an isolated real token cache.
function client() {
  return import("@/lib/ga4/client");
}

describe("GA4 Data API client", () => {
  it("exchanges a verifiable RS256 service-account assertion and maps named comparison rows", async () => {
    const fetchMock = stubFetch((url) => (url === TOKEN_URL ? token() : json(STATS)));
    const ga4 = await client();

    expect(await ga4.getStats(env, WINDOW)).toEqual({
      pageviews: 15,
      visitors: 6,
      comparison: { pageviews: 10, visitors: 4 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url) === TOKEN_URL);

    if (!tokenCall) throw new Error("Missing token request");

    const init = tokenCall[1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toContain(
      "application/x-www-form-urlencoded",
    );
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect([...form.keys()].sort()).toEqual(["assertion", "grant_type"]);

    const parts = z
      .tuple([z.string(), z.string(), z.string()])
      .parse(form.get("assertion")?.split("."));

    const [header, payload, signature] = parts;
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toMatchObject({
      alg: "RS256",
      typ: "JWT",
    });

    const claims = z
      .object({
        iss: z.string(),
        scope: z.string(),
        aud: z.string(),
        iat: z.number().int(),
        exp: z.number().int(),
      })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString()));

    expect(claims).toMatchObject({
      iss: EMAIL,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: TOKEN_URL,
      iat: Math.floor(NOW / 1000),
    });
    expect(claims.exp).toBeGreaterThan(claims.iat);
    expect(claims.exp).toBeLessThanOrEqual(claims.iat + 3600);
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        new Uint8Array(Buffer.from(signature, "base64url")),
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ).toBe(true);

    const reportCall = fetchMock.mock.calls.find(([url]) => String(url) === REPORT_URL);

    if (!reportCall) throw new Error("Missing report request");

    expect(reportCall[1]?.method).toBe("POST");
    expect(new Headers(reportCall[1]?.headers).get("Authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(JSON.parse(String(reportCall[1]?.body))).toMatchObject({
      dimensions: [],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      dateRanges: [
        { startDate: "2026-01-02", endDate: "2026-01-08" },
        { startDate: "2025-12-26", endDate: "2026-01-01" },
      ],
    });
  });

  it("shares one token exchange across concurrent fanout without caching reports", async () => {
    const fetchMock = stubFetch((url) => (url === TOKEN_URL ? token() : json(STATS)));
    const ga4 = await client();
    const results = await Promise.all([1, 2, 3, 4].map(() => ga4.getStats(env, WINDOW)));
    await ga4.getStats(env, WINDOW);

    expect(results.map((stats) => stats.pageviews)).toEqual([15, 15, 15, 15]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === TOKEN_URL)).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === REPORT_URL)).toHaveLength(5);
  });

  it("refreshes the cached token before its one-hour expiry", async () => {
    let exchanges = 0;

    const fetchMock = stubFetch((url) => {
      if (url === TOKEN_URL) return token(`token-${++exchanges}`);

      return json(STATS);
    });

    const ga4 = await client();
    await ga4.getStats(env, WINDOW);
    vi.mocked(Date.now).mockReturnValue(NOW + 58 * 60_000);
    await ga4.getStats(env, WINDOW);
    vi.mocked(Date.now).mockReturnValue(NOW + 59 * 60_000);
    await ga4.getStats(env, WINDOW);

    expect(exchanges).toBe(2);
    expect(
      fetchMock.mock.calls
        .filter(([url]) => String(url) === REPORT_URL)
        .map(([, init]) => new Headers(init?.headers).get("Authorization")),
    ).toEqual(["Bearer token-1", "Bearer token-1", "Bearer token-2"]);
  });

  it("replaces a rejected token once and keeps the replacement for later calls", async () => {
    let exchanges = 0;
    let reports = 0;

    const fetchMock = stubFetch((url) => {
      if (url === TOKEN_URL) return token(`token-${++exchanges}`);

      return ++reports === 1 ? json({}, 401) : json(STATS);
    });

    const ga4 = await client();
    expect(await ga4.getStats(env, WINDOW)).toMatchObject({ pageviews: 15 });
    await ga4.getStats(env, WINDOW);

    expect(exchanges).toBe(2);
    expect(
      fetchMock.mock.calls
        .filter(([url]) => String(url) === REPORT_URL)
        .map(([, init]) => new Headers(init?.headers).get("Authorization")),
    ).toEqual(["Bearer token-1", "Bearer token-2", "Bearer token-2"]);
  });

  it("stops after a second 401 and does not retain that rejected token", async () => {
    let exchanges = 0;
    let rejecting = true;
    let reports = 0;
    stubFetch((url) => {
      if (url === TOKEN_URL) return token(`token-${++exchanges}`);

      reports += 1;

      return rejecting ? json({}, 401) : json(STATS);
    });
    const ga4 = await client();
    await expect(ga4.getStats(env, WINDOW)).rejects.toMatchObject({ status: 401 });
    expect(exchanges).toBe(2);
    expect(reports).toBe(2);
    rejecting = false;
    expect(await ga4.getStats(env, WINDOW)).toMatchObject({ pageviews: 15 });
    expect(exchanges).toBe(3);
  });

  it("reads daily sessions by header name rather than mistaking them for total users", async () => {
    stubFetch((url) =>
      url === TOKEN_URL
        ? token()
        : json({
            dimensionHeaders: [{ name: "date" }],
            metricHeaders: [{ name: "sessions" }, { name: "screenPageViews" }],
            rows: [
              {
                dimensionValues: [{ value: "20260108" }],
                metricValues: [{ value: "3" }, { value: "9" }],
              },
            ],
            rowCount: 1,
          }),
    );
    const ga4 = await client();

    expect(await ga4.getPageviews(env, { ...WINDOW, unit: "day", timezone: "UTC" })).toEqual({
      pageviews: [{ x: "2026-01-08T00:00:00Z", y: 9 }],
      sessions: [{ x: "2026-01-08T00:00:00Z", y: 3 }],
    });
  });

  it("paginates all referrers, combines hostnames and only then applies the caller limit", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      const body = reportRequestSchema.parse(JSON.parse(String(init.body)));
      bodies.push(body);

      const rows =
        body.offset === "2"
          ? [
              {
                dimensionValues: [{ value: "https://news.example/two" }],
                metricValues: [{ value: "3" }],
              },
            ]
          : [
              {
                dimensionValues: [{ value: "https://news.example/one" }],
                metricValues: [{ value: "2" }],
              },
              {
                dimensionValues: [{ value: "https://jobs.example/apply" }],
                metricValues: [{ value: "4" }],
              },
            ];

      return json({
        dimensionHeaders: [{ name: "pageReferrer" }],
        metricHeaders: [{ name: "totalUsers" }],
        rows,
        rowCount: 3,
      });
    });
    const ga4 = await client();

    expect(
      await ga4.getMetrics(env, {
        ...WINDOW,
        type: "referrer",
        unit: "day",
        timezone: "UTC",
        limit: 1,
      }),
    ).toEqual([{ x: "news.example", y: 5 }]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({
      dimensions: [{ name: "pageReferrer" }],
      metrics: [{ name: "totalUsers" }],
      limit: "250000",
    });
    expect(bodies[1]).toMatchObject({ offset: "2", limit: "250000" });
  });

  it("rejects an empty page when GA4 says rows remain instead of returning partial metrics", async () => {
    stubFetch((url) =>
      url === TOKEN_URL
        ? token()
        : json({
            dimensionHeaders: [{ name: "pageReferrer" }],
            metricHeaders: [{ name: "totalUsers" }],
            rows: [],
            rowCount: 1,
          }),
    );
    const ga4 = await client();

    await expect(
      ga4.getMetrics(env, {
        ...WINDOW,
        type: "referrer",
        unit: "day",
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("does not cache a malformed OAuth response", async () => {
    let exchanges = 0;
    stubFetch((url) => {
      if (url !== TOKEN_URL) return json(STATS);

      return ++exchanges === 1
        ? json({ access_token: ACCESS_TOKEN, token_type: "Bearer", expires_in: "3600" })
        : token();
    });
    const ga4 = await client();

    await expect(ga4.getStats(env, WINDOW)).rejects.toMatchObject({ name: "ZodError" });
    expect(await ga4.getStats(env, WINDOW)).toMatchObject({ pageviews: 15 });
    expect(exchanges).toBe(2);
  });

  it.each(["report", "json", "token", "transport", "credentials"] as const)(
    "keeps credentials, URLs, tokens and response inputs out of %s errors",
    async (stage) => {
      const sensitive = "sensitive-upstream-response";
      stubFetch((url) => {
        if (stage === "transport") {
          throw new TypeError(`${REPORT_URL} ${ACCESS_TOKEN} ${privateKeyPem} ${sensitive}`);
        }

        if (url === TOKEN_URL) {
          return stage === "token"
            ? json({ access_token: ACCESS_TOKEN, token_type: sensitive, expires_in: 3600 })
            : token();
        }

        if (stage === "json") return new Response(`<html>${sensitive}</html>`);

        return json({
          dimensionHeaders: [{ name: "dateRange" }],
          metricHeaders: [{ name: "screenPageViews" }, { name: "totalUsers" }],
          rows: [
            {
              dimensionValues: [{ value: "date_range_0" }],
              metricValues: [{ value: sensitive }, { value: "4" }],
            },
          ],
        });
      });

      if (stage === "credentials") {
        env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
          client_email: EMAIL,
          private_key: `${privateKeyPem}${sensitive}`,
        });
      }

      const ga4 = await client();

      const failure = await ga4.getStats(env, WINDOW).then(
        () => null,
        (cause: unknown) => cause,
      );

      expect(failure).toMatchObject({
        name: stage === "transport" || stage === "credentials" ? "Error" : "ZodError",
      });
      const text = inspect(failure, { depth: null });

      for (const secret of [
        PROPERTY,
        EMAIL,
        privateKeyPem,
        "BEGIN PRIVATE KEY",
        ACCESS_TOKEN,
        TOKEN_URL,
        REPORT_URL,
        sensitive,
      ]) {
        expect(text).not.toContain(secret);
      }
    },
  );
});
