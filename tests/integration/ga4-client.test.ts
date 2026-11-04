import { inspect } from "node:util";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import type { JsonValue } from "@/lib/types/json";

const NOW = Date.UTC(2026, 0, 8, 12);

const WINDOW = {
  startAt: Date.UTC(2026, 0, 2, 6),
  endAt: Date.UTC(2026, 0, 9, 5, 59),
  timezone: "America/Chicago",
};

const PROPERTY = "123456789";
const PROPERTY_TIMEZONE = "America/Chicago";
const EMAIL = "analytics-test@project.iam.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`;
const ACCESS_TOKEN = "test-access-token-not-a-real-credential";

const STATS: JsonValue = {
  metadata: { timeZone: PROPERTY_TIMEZONE },
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

const primitiveFilterSchema = z.union([
  z.object({
    filter: z.object({
      fieldName: z.literal("pagePath"),
      stringFilter: z.object({
        matchType: z.literal("EXACT"),
        value: z.string(),
        caseSensitive: z.literal(true),
      }),
    }),
  }),
  z.object({
    filter: z.object({
      fieldName: z.literal("dateHour"),
      inListFilter: z.object({ values: z.array(z.string().regex(/^\d{10}$/)).min(1) }),
    }),
  }),
]);

const reportRequestSchema = z.object({
  dimensions: z.array(z.object({ name: z.string() })),
  metrics: z.array(z.object({ name: z.string() })),
  dateRanges: z.array(z.object({ startDate: z.string(), endDate: z.string() })),
  dimensionFilter: z
    .union([
      primitiveFilterSchema,
      z.object({ andGroup: z.object({ expressions: z.array(primitiveFilterSchema) }) }),
    ])
    .optional(),
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
  // SAFETY: the GA4 client reads only its source, property, time zone and service account.
  env = {
    ANALYTICS_SOURCE: "ga4",
    GA4_PROPERTY_ID: PROPERTY,
    GA4_TIME_ZONE: PROPERTY_TIMEZONE,
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

  it("uses Chicago dates and the daily path when the viewer matches the property", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json({
        metadata: { timeZone: PROPERTY_TIMEZONE },
        dimensionHeaders: [{ name: "date" }],
        metricHeaders: [{ name: "sessions" }, { name: "screenPageViews" }],
        rows: [
          {
            dimensionValues: [{ value: "20260108" }],
            metricValues: [{ value: "3" }, { value: "9" }],
          },
        ],
        rowCount: 1,
      });
    });
    const ga4 = await client();

    expect(await ga4.getPageviews(env, { ...WINDOW, unit: "day" })).toEqual({
      pageviews: [{ x: "2026-01-08T00:00:00Z", y: 9 }],
      sessions: [{ x: "2026-01-08T00:00:00Z", y: 3 }],
    });
    expect(bodies[0]).toMatchObject({
      dimensions: [{ name: "date" }],
      dateRanges: [{ startDate: "2026-01-02", endDate: "2026-01-08" }],
    });
    expect(bodies[0].dimensionFilter).toBeUndefined();
  });

  it("regroups Chicago wall-clock hours at UTC midnight and excludes outside hours", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json({
        metadata: { timeZone: PROPERTY_TIMEZONE },
        dimensionHeaders: [{ name: "dateHour" }],
        metricHeaders: [{ name: "sessions" }, { name: "screenPageViews" }],
        rows: [16, 17, 18, 19, 20].map((hour, i) => ({
          dimensionValues: [{ value: `20260102${hour}` }],
          metricValues: [{ value: String(i + 1) }, { value: String((i + 1) * 2) }],
        })),
      });
    });
    const ga4 = await client();

    expect(
      await ga4.getPageviews(env, {
        startAt: Date.UTC(2026, 0, 2, 23),
        endAt: Date.UTC(2026, 0, 3, 1, 30),
        unit: "day",
        timezone: "UTC",
        path: "/@ada",
      }),
    ).toEqual({
      pageviews: [
        { x: "2026-01-02T00:00:00Z", y: 4 },
        { x: "2026-01-03T00:00:00Z", y: 14 },
      ],
      sessions: [
        { x: "2026-01-02T00:00:00Z", y: 2 },
        { x: "2026-01-03T00:00:00Z", y: 7 },
      ],
    });
    expect(bodies[0]).toMatchObject({
      dimensions: [{ name: "dateHour" }],
      dateRanges: [{ startDate: "2026-01-02", endDate: "2026-01-02" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "EXACT", value: "/@ada", caseSensitive: true },
              },
            },
            {
              filter: {
                fieldName: "dateHour",
                inListFilter: { values: ["2026010217", "2026010218", "2026010219"] },
              },
            },
          ],
        },
      },
    });
  });

  it.each([
    {
      date: "2026-11-01",
      start: "2026-11-01T05:00:00Z",
      end: "2026-11-02T05:59:59Z",
      hours: Array.from({ length: 24 }, (_, hour) => hour),
      rowHours: [0, 1, 2, 17, 18, 23],
      nextDate: "2026-11-02",
    },
    {
      date: "2026-03-08",
      start: "2026-03-08T06:00:00Z",
      end: "2026-03-09T04:59:59Z",
      hours: Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => hour !== 2),
      rowHours: [0, 1, 3, 18, 19, 23],
      nextDate: "2026-03-09",
    },
  ])("filters and parses Chicago DST hours on $date for UTC viewers", async (fixture) => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    const rawDate = fixture.date.replaceAll("-", "");
    const values = fixture.hours.map((hour) => `${rawDate}${String(hour).padStart(2, "0")}`);
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      const body = reportRequestSchema.parse(JSON.parse(String(init.body)));
      bodies.push(body);
      const dimension = body.dimensions[0]?.name;
      const current = body.dateRanges[0].startDate === fixture.date;

      return json({
        metadata: { timeZone: PROPERTY_TIMEZONE },
        dimensionHeaders: body.dimensions,
        metricHeaders: body.metrics,
        rows:
          dimension === "dateHour"
            ? fixture.rowHours.map((hour, i) => ({
                dimensionValues: [{ value: `${rawDate}${String(hour).padStart(2, "0")}` }],
                metricValues: [{ value: String(i + 1) }, { value: "1" }],
              }))
            : [
                {
                  dimensionValues: dimension
                    ? [{ value: dimension === "pagePath" ? "/@ada" : "US" }]
                    : [],
                  metricValues: body.metrics.map(({ name }) => ({
                    value: String(current ? (name === "screenPageViews" ? 21 : 8) : 2),
                  })),
                },
              ],
      });
    });
    const ga4 = await client();

    const opts = {
      startAt: Date.parse(fixture.start),
      endAt: Date.parse(fixture.end),
      timezone: "UTC",
      path: "/@ada",
      unit: "day",
    };

    expect(await ga4.getPageviews(env, opts)).toEqual({
      pageviews: [
        { x: `${fixture.date}T00:00:00Z`, y: 10 },
        { x: `${fixture.nextDate}T00:00:00Z`, y: 11 },
      ],
      sessions: [
        { x: `${fixture.date}T00:00:00Z`, y: 4 },
        { x: `${fixture.nextDate}T00:00:00Z`, y: 2 },
      ],
    });
    expect(await ga4.getStats(env, opts)).toEqual({
      pageviews: 21,
      visitors: 8,
      comparison: { pageviews: 2, visitors: 2 },
    });

    for (const type of ["path", "country", "device", "referrer"] as const) {
      await ga4.getMetrics(env, { ...opts, type });
    }

    const current = bodies.filter((body) => body.dateRanges[0].startDate === fixture.date);
    expect(current).toHaveLength(6);

    for (const body of current) {
      expect(body.dateRanges).toEqual([{ startDate: fixture.date, endDate: fixture.date }]);
      expect(body.dimensionFilter).toMatchObject({
        andGroup: {
          expressions: [
            { filter: { fieldName: "pagePath" } },
            { filter: { fieldName: "dateHour", inListFilter: { values } } },
          ],
        },
      });
    }
  });

  it.each([
    ["2026-11-01", "2026-11-01T05:00:00Z", "2026-11-02T05:59:59Z", "2026-10-31"],
    ["2026-03-08", "2026-03-08T06:00:00Z", "2026-03-09T04:59:59Z", "2026-03-07"],
  ])("compares Chicago calendar days across DST on %s", async (date, start, end, previous) => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json(STATS);
    });
    const ga4 = await client();
    await ga4.getStats(env, {
      startAt: Date.parse(start),
      endAt: Date.parse(end),
      timezone: PROPERTY_TIMEZONE,
    });
    expect(bodies[0].dateRanges).toEqual([
      { startDate: date, endDate: date },
      { startDate: previous, endDate: previous },
    ]);
    expect(bodies[0].dimensionFilter).toBeUndefined();
  });

  it("rejects a changed property time zone without retaining upstream data", async () => {
    const sensitive = "sensitive-upstream-time-zone";
    stubFetch((url) => (url === TOKEN_URL ? token() : json({ metadata: { timeZone: sensitive } })));
    const ga4 = await client();
    const failure = await ga4.getStats(env, WINDOW).catch((cause: unknown) => cause);

    expect(failure).toMatchObject({ name: "ZodError" });
    expect(String(failure)).toContain("GA4 report time zone does not match configuration");
    expect(inspect(failure, { depth: null })).not.toContain(sensitive);
  });

  it.each(["", "not/a-timezone"])(
    "rejects invalid property time zone %s before I/O",
    async (timezone) => {
      env.GA4_TIME_ZONE = timezone;
      const fetchMock = stubFetch(() => token());
      const ga4 = await client();

      await expect(ga4.getStats(env, WINDOW)).rejects.toThrow(
        "GA4 time zone configuration is invalid",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("uses the first included property-hour start for fractional viewer offsets without sending an empty in-list", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json({
        metadata: { timeZone: PROPERTY_TIMEZONE },
        dimensionHeaders: [],
        metricHeaders: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        rows: [{ dimensionValues: [], metricValues: [{ value: "1" }, { value: "2" }] }],
      });
    });
    const ga4 = await client();

    const opts = {
      startAt: Date.UTC(2026, 0, 1, 18, 15),
      endAt: Date.UTC(2026, 0, 1, 18, 30),
      timezone: "Asia/Kathmandu",
      unit: "day",
    };

    expect(await ga4.getPageviews(env, opts)).toEqual({ pageviews: [], sessions: [] });
    expect(await ga4.getMetrics(env, { ...opts, type: "country" })).toEqual([]);
    expect(await ga4.getStats(env, opts)).toEqual({
      pageviews: 0,
      visitors: 0,
      comparison: { pageviews: 2, visitors: 1 },
    });
    expect(bodies).toHaveLength(1);
    const filter = bodies[0].dimensionFilter;

    const hours =
      filter && "filter" in filter && filter.filter.fieldName === "dateHour"
        ? filter.filter.inListFilter.values
        : [];

    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe("2025123113");
    expect(hours.at(-1)).toBe("2026010112");
  });

  it.each([false, true])(
    "accepts a genuine headerless empty report (explicit zero count: %s)",
    async (explicitCount) => {
      const empty: JsonValue = {
        kind: "analyticsData#runReport",
        metadata: { timeZone: PROPERTY_TIMEZONE },
      };

      if (explicitCount) empty.rowCount = 0;

      stubFetch((url, init) => {
        if (url === TOKEN_URL) return token();

        const body = reportRequestSchema.parse(JSON.parse(String(init.body)));

        if (body.dimensions.length === 0 && body.dateRanges[0].startDate === "2026-01-02") {
          return json({
            kind: "analyticsData#runReport",
            metadata: { timeZone: PROPERTY_TIMEZONE },
            metricHeaders: [{ name: "screenPageViews" }, { name: "totalUsers" }],
            rows: [{ metricValues: [{ value: "22" }, { value: "13" }] }],
            rowCount: 1,
          });
        }

        return json(empty);
      });
      const ga4 = await client();

      const opts = {
        startAt: Date.UTC(2026, 0, 2, 8),
        endAt: Date.UTC(2026, 0, 8, 12),
        timezone: "America/Los_Angeles",
        unit: "day",
      };

      expect(await ga4.getStats(env, opts)).toEqual({
        pageviews: 22,
        visitors: 13,
        comparison: { pageviews: 0, visitors: 0 },
      });
      expect(await ga4.getPageviews(env, opts)).toEqual({ pageviews: [], sessions: [] });
      expect(await ga4.getMetrics(env, { ...opts, type: "country" })).toEqual([]);
    },
  );

  it.each([{}, { kind: "analyticsData#runReport", rowCount: 1 }, { kind: "unrelated#response" }])(
    "rejects a headerless envelope that is not a genuine empty report: %j",
    async (response) => {
      stubFetch((url) =>
        url === TOKEN_URL
          ? token()
          : json({ ...response, metadata: { timeZone: PROPERTY_TIMEZONE } }),
      );
      const ga4 = await client();

      await expect(ga4.getStats(env, WINDOW)).rejects.toMatchObject({ name: "ZodError" });
    },
  );

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
        metadata: { timeZone: PROPERTY_TIMEZONE },
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
            metadata: { timeZone: PROPERTY_TIMEZONE },
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
          metadata: { timeZone: PROPERTY_TIMEZONE },
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
