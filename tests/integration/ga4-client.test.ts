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

  it("groups UTC hours around local midnight into the prior local date and excludes outside hours", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json({
        dimensionHeaders: [{ name: "dateHour" }],
        metricHeaders: [{ name: "sessions" }, { name: "screenPageViews" }],
        rows: [
          {
            dimensionValues: [{ value: "2026010207" }],
            metricValues: [{ value: "90" }, { value: "90" }],
          },
          {
            dimensionValues: [{ value: "2026010208" }],
            metricValues: [{ value: "1" }, { value: "2" }],
          },
          {
            dimensionValues: [{ value: "2026010307" }],
            metricValues: [{ value: "2" }, { value: "3" }],
          },
          {
            dimensionValues: [{ value: "2026010308" }],
            metricValues: [{ value: "90" }, { value: "90" }],
          },
        ],
      });
    });
    const ga4 = await client();

    expect(
      await ga4.getPageviews(env, {
        startAt: Date.UTC(2026, 0, 2, 8),
        endAt: Date.UTC(2026, 0, 3, 7, 30),
        unit: "day",
        timezone: "America/Los_Angeles",
      }),
    ).toEqual({
      pageviews: [{ x: "2026-01-02T00:00:00Z", y: 5 }],
      sessions: [{ x: "2026-01-02T00:00:00Z", y: 3 }],
    });
    expect(bodies[0]).toMatchObject({
      dimensions: [{ name: "dateHour" }],
      dateRanges: [{ startDate: "2026-01-02", endDate: "2026-01-03" }],
      dimensionFilter: {
        filter: {
          fieldName: "dateHour",
          inListFilter: {
            values: [
              "2026010208",
              "2026010209",
              "2026010210",
              "2026010211",
              "2026010212",
              "2026010213",
              "2026010214",
              "2026010215",
              "2026010216",
              "2026010217",
              "2026010218",
              "2026010219",
              "2026010220",
              "2026010221",
              "2026010222",
              "2026010223",
              "2026010300",
              "2026010301",
              "2026010302",
              "2026010303",
              "2026010304",
              "2026010305",
              "2026010306",
              "2026010307",
            ],
          },
        },
      },
    });
  });

  it("keeps Chicago's 25-hour fall-back day, unique totals and all breakdowns on the same hour window", async () => {
    const base = {
      pagePath: "/@ada",
      pageReferrer: "https://news.example/article",
      deviceCategory: "desktop",
      countryId: "US",
      user: "repeat",
      session: "one",
    };

    const events = [
      { ...base, dateHour: "2026103004", user: "outside" },
      { ...base, dateHour: "2026103005", user: "previous" },
      { ...base, dateHour: "2026110104", user: "previous" },
      { ...base, dateHour: "2026110105" },
      { ...base, dateHour: "2026110106" },
      { ...base, dateHour: "2026110107" },
      { ...base, dateHour: "2026110205", session: "two" },
      { ...base, dateHour: "2026110206", session: "three" },
      { ...base, dateHour: "2026110207", user: "outside" },
      { ...base, dateHour: "2026110108", user: "another", pagePath: "/@other" },
    ];

    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      const body = reportRequestSchema.parse(JSON.parse(String(init.body)));
      bodies.push(body);
      const filter = body.dimensionFilter;

      const expressions = filter
        ? "andGroup" in filter
          ? filter.andGroup.expressions
          : [filter]
        : [];

      const hours = expressions.flatMap(({ filter: primitive }) =>
        primitive.fieldName === "dateHour" ? primitive.inListFilter.values : [],
      );

      const paths = expressions.flatMap(({ filter: primitive }) =>
        primitive.fieldName === "pagePath" ? [primitive.stringFilter.value] : [],
      );

      const dimension = z
        .enum(["dateHour", "pagePath", "pageReferrer", "deviceCategory", "countryId"])
        .optional()
        .parse(body.dimensions[0]?.name);

      const groups = new Map<string, typeof events>();

      for (const event of events) {
        if (
          !hours.includes(event.dateHour) ||
          (paths.length > 0 && !paths.includes(event.pagePath))
        ) {
          continue;
        }

        const key = dimension ? event[dimension] : "";
        const group = groups.get(key) ?? [];
        group.push(event);
        groups.set(key, group);
      }

      return json({
        dimensionHeaders: body.dimensions,
        metricHeaders: body.metrics,
        rows: [...groups].map(([key, group]) => ({
          dimensionValues: dimension ? [{ value: key }] : [],
          metricValues: body.metrics.map(({ name }) => {
            switch (name) {
              case "totalUsers":
                return { value: String(new Set(group.map((event) => event.user)).size) };
              case "sessions":
                return { value: String(new Set(group.map((event) => event.session)).size) };
              default:
                return { value: String(group.length) };
            }
          }),
        })),
        rowCount: groups.size,
      });
    });
    const ga4 = await client();

    const opts = {
      startAt: Date.UTC(2026, 10, 1, 5),
      endAt: Date.UTC(2026, 10, 2, 6, 30),
      timezone: "America/Chicago",
      path: "/@ada",
      unit: "day",
    };

    expect(await ga4.getStats(env, opts)).toEqual({
      pageviews: 5,
      visitors: 1,
      comparison: { pageviews: 2, visitors: 1 },
    });
    expect(await ga4.getPageviews(env, opts)).toEqual({
      pageviews: [
        { x: "2026-11-01T00:00:00Z", y: 4 },
        { x: "2026-11-02T00:00:00Z", y: 1 },
      ],
      sessions: [
        { x: "2026-11-01T00:00:00Z", y: 4 },
        { x: "2026-11-02T00:00:00Z", y: 1 },
      ],
    });

    for (const [type, x, y] of [
      ["referrer", "news.example", 1],
      ["device", "desktop", 1],
      ["country", "US", 1],
      ["path", "/@ada", 5],
    ] as const) {
      expect(await ga4.getMetrics(env, { ...opts, type })).toEqual([{ x, y }]);
    }

    const currentHours = [
      "2026110105",
      "2026110106",
      "2026110107",
      "2026110108",
      "2026110109",
      "2026110110",
      "2026110111",
      "2026110112",
      "2026110113",
      "2026110114",
      "2026110115",
      "2026110116",
      "2026110117",
      "2026110118",
      "2026110119",
      "2026110120",
      "2026110121",
      "2026110122",
      "2026110123",
      "2026110200",
      "2026110201",
      "2026110202",
      "2026110203",
      "2026110204",
      "2026110205",
      "2026110206",
    ];

    const currentFilter = {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "pagePath",
              stringFilter: {
                matchType: "EXACT",
                value: "/@ada",
                caseSensitive: true,
              },
            },
          },
          { filter: { fieldName: "dateHour", inListFilter: { values: currentHours } } },
        ],
      },
    };

    const currentBodies = bodies.filter((body) => body.dateRanges[0].startDate === "2026-11-01");
    expect(currentBodies).toHaveLength(6);

    for (const body of currentBodies) {
      expect(body.dateRanges).toEqual([{ startDate: "2026-11-01", endDate: "2026-11-02" }]);
      expect(body.dimensionFilter).toEqual(currentFilter);
    }

    const previous = bodies.find((body) => body.dateRanges[0].startDate === "2026-10-30");
    expect(previous?.dimensions).toEqual([]);
    expect(previous?.dateRanges).toEqual([{ startDate: "2026-10-30", endDate: "2026-11-01" }]);
    const previousFilter = previous?.dimensionFilter;

    const previousHours =
      previousFilter && "andGroup" in previousFilter
        ? previousFilter.andGroup.expressions.flatMap(({ filter }) =>
            filter.fieldName === "dateHour" ? filter.inListFilter.values : [],
          )
        : [];

    expect(previousHours).toHaveLength(48);
    expect(previousHours[0]).toBe("2026103005");
    expect(previousHours.at(-1)).toBe("2026110104");
  });

  it("uses the first included UTC-hour start for fractional offsets without sending an empty in-list", async () => {
    const bodies: z.infer<typeof reportRequestSchema>[] = [];
    stubFetch((url, init) => {
      if (url === TOKEN_URL) return token();

      bodies.push(reportRequestSchema.parse(JSON.parse(String(init.body))));

      return json({
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
    expect(hours[0]).toBe("2025123119");
    expect(hours.at(-1)).toBe("2026010118");
  });

  it.each([false, true])(
    "accepts a genuine headerless empty report (explicit zero count: %s)",
    async (explicitCount) => {
      const empty: JsonValue = explicitCount
        ? { kind: "analyticsData#runReport", rowCount: 0 }
        : { kind: "analyticsData#runReport" };

      stubFetch((url, init) => {
        if (url === TOKEN_URL) return token();

        const body = reportRequestSchema.parse(JSON.parse(String(init.body)));

        if (body.dimensions.length === 0 && body.dateRanges[0].startDate === "2026-01-02") {
          return json({
            kind: "analyticsData#runReport",
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
      stubFetch((url) => (url === TOKEN_URL ? token() : json(response)));
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
