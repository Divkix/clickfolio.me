import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { z } from "zod";
import type * as Clerk from "@/lib/auth/clerk";
import { handleChanges, user } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/types/json";
import type { StubbedAdminSession, StubbedSession } from "@/tests/helpers/authenticate-stub";
import { createTestDb } from "@/tests/helpers/pglite-db";
import type { TestDb, TestDbHandle } from "@/tests/helpers/pglite-db";
import { serverHandler } from "@/tests/helpers/server-route";

const mocks = vi.hoisted(() => ({
  user: vi.fn<() => Promise<StubbedSession>>(),
  admin: vi.fn<() => Promise<StubbedAdminSession>>(),
  db: vi.fn<() => TestDb>(),
  env: {
    HYPERDRIVE: {},
    ANALYTICS_SOURCE: "ga4",
    GA4_PROPERTY_ID: "123456789",
    GA4_TIME_ZONE: "America/Chicago",
    GA4_SERVICE_ACCOUNT_JSON: "",
  },
}));

// Auth mocks load their helpers after Vitest installs the hoisted replacements.
vi.mock("@/lib/auth/clerk", async (importOriginal) => ({
  ...(await importOriginal<typeof Clerk>()),
  authenticate: (await import("@/tests/helpers/authenticate-stub")).authenticateStub(() =>
    mocks.user(),
  ),
}));

vi.mock("@/lib/auth/admin", async () => ({
  authenticateAdmin: (await import("@/tests/helpers/authenticate-stub")).authenticateAdminStub(() =>
    mocks.admin(),
  ),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db() }));

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));

const NOW = Date.UTC(2026, 0, 8, 12);
const CURRENT_RANGE = { startDate: "2026-01-02", endDate: "2026-01-08" };
const PREVIOUS_RANGE = { startDate: "2025-12-26", endDate: "2026-01-01" };

const fieldFilterSchema = z.union([
  z.object({
    fieldName: z.string(),
    stringFilter: z.object({
      matchType: z.string(),
      value: z.string(),
      caseSensitive: z.boolean(),
    }),
  }),
  z.object({
    fieldName: z.string(),
    inListFilter: z.object({ values: z.array(z.string()) }),
  }),
]);

type FieldFilter = z.infer<typeof fieldFilterSchema>;

type ReportFilter = { filter: FieldFilter } | { andGroup: { expressions: ReportFilter[] } };

const reportFilterSchema: z.ZodType<ReportFilter> = z.lazy(() =>
  z.union([
    z.object({ filter: fieldFilterSchema }),
    z.object({ andGroup: z.object({ expressions: z.array(reportFilterSchema) }) }),
  ]),
);

const reportRequestSchema = z.object({
  dimensions: z.array(z.object({ name: z.string() })),
  metrics: z.array(z.object({ name: z.string() })),
  dateRanges: z.array(z.object({ startDate: z.string(), endDate: z.string() })),
  dimensionFilter: reportFilterSchema.optional(),
  limit: z.string().optional(),
  orderBys: z
    .array(
      z.union([
        z.object({ metric: z.object({ metricName: z.string() }), desc: z.boolean() }),
        z.object({ dimension: z.object({ dimensionName: z.string() }) }),
      ]),
    )
    .optional(),
});

type ReportRequest = z.infer<typeof reportRequestSchema>;

let testDb: TestDbHandle;
let db: TestDb;
let privateKeyPem: string;
let credentialId = 0;

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

  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
  testDb = await createTestDb();
  db = testDb.db;
  mocks.db.mockReturnValue(db);
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  mocks.env.ANALYTICS_SOURCE = "ga4";
  mocks.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
    type: "service_account",
    client_email: `route-${++credentialId}@project.iam.gserviceaccount.com`,
    private_key: privateKeyPem,
  });
  await testDb.reset();
  const now = new Date(NOW).toISOString();

  const [alice] = await db
    .insert(user)
    .values({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      handle: "alice",
      clerkId: "clerk-1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!alice) throw new Error("Missing analytics test user");

  await db.insert(handleChanges).values({
    id: "change-1",
    userId: alice.id,
    oldHandle: "alice-old",
    newHandle: "alice",
    createdAt: now,
  });
  mocks.user.mockResolvedValue({
    user: alice,
    dbUser: { id: alice.id, handle: alice.handle, clerkId: "clerk-1" },
    error: null,
  });
  mocks.admin.mockResolvedValue({
    user: { id: "admin-1", email: "admin@example.com", name: "Admin", isAdmin: true },
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function json(body: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function report(
  dimensions: string[],
  metrics: string[],
  rows: { dimensions: string[]; metrics: number[] }[],
): JsonValue {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map((row) => ({
      dimensionValues: row.dimensions.map((value) => ({ value })),
      metricValues: row.metrics.map((value) => ({ value: String(value) })),
    })),
    rowCount: rows.length,
    metadata: { timeZone: "America/Chicago" },
  };
}

function stubGa4(upstream: (body: ReportRequest) => Response) {
  const reports: ReportRequest[] = [];

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);

    if (url === "https://oauth2.googleapis.com/token") {
      return json({ access_token: "route-access-token", token_type: "Bearer", expires_in: 3600 });
    }

    expect(url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer route-access-token");
    const body = reportRequestSchema.parse(JSON.parse(String(init?.body)));
    reports.push(body);

    return upstream(body);
  });

  vi.stubGlobal("fetch", fetchMock);

  return { reports, fetchMock };
}

function reportFilters(expression: ReportFilter | undefined): FieldFilter[] {
  if (!expression) return [];

  return "filter" in expression
    ? [expression.filter]
    : expression.andGroup.expressions.flatMap(reportFilters);
}

function reportPath(body: ReportRequest): string | undefined {
  const filter = reportFilters(body.dimensionFilter).find(
    ({ fieldName }) => fieldName === "pagePath",
  );

  return filter && "stringFilter" in filter ? filter.stringFilter.value : undefined;
}

function reportHours(body: ReportRequest): string[] {
  const filter = reportFilters(body.dimensionFilter).find(
    ({ fieldName }) => fieldName === "dateHour",
  );

  if (!filter || !("inListFilter" in filter)) throw new Error("Missing GA4 hour filter");

  return filter.inListFilter.values;
}

function ga4Body(body: ReportRequest): JsonValue {
  const path = reportPath(body);
  const current = path === "/@alice";
  const views = path ? (current ? 14 : 7) : 21;
  const visitors = path ? (current ? 5 : 3) : 8;
  const dimension = body.dimensions[0]?.name;

  switch (dimension) {
    case undefined:
      // Reversed rows and metric headers make period/name mapping observable.
      return report(
        ["dateRange"],
        ["totalUsers", "screenPageViews"],
        [
          { dimensions: ["date_range_1"], metrics: [4, 14] },
          { dimensions: ["date_range_0"], metrics: [visitors, views] },
        ],
      );
    case "date":
      return report(
        ["date"],
        ["screenPageViews", "sessions"],
        [
          { dimensions: ["20260107"], metrics: path ? (current ? [4, 2] : [2, 1]) : [6, 3] },
          { dimensions: ["20260108"], metrics: path ? (current ? [10, 4] : [5, 2]) : [15, 6] },
        ],
      );
    case "pagePath":
      return report(
        [dimension],
        ["screenPageViews"],
        [
          { dimensions: ["/@alice"], metrics: [14] },
          { dimensions: ["/"], metrics: [10] },
          { dimensions: ["/@alice/projects"], metrics: [8] },
          { dimensions: ["/@bob"], metrics: [7] },
        ],
      );
    case "pageReferrer":
      return report(
        [dimension],
        ["totalUsers"],
        [
          { dimensions: ["https://news.example/one"], metrics: [path ? (current ? 2 : 1) : 3] },
          { dimensions: ["https://news.example/two"], metrics: [path ? 1 : 2] },
          { dimensions: ["https://careers.example/jobs"], metrics: [1] },
          { dimensions: ["https://clickfolio.me/explore"], metrics: [7] },
          { dimensions: [""], metrics: [9] },
        ],
      );
    case "deviceCategory":
    case "countryId":
      return report(
        [dimension],
        ["totalUsers"],
        [
          {
            dimensions: [dimension === "countryId" ? "US" : "desktop"],
            metrics: [path ? (current ? 4 : 2) : 6],
          },
          { dimensions: [dimension === "countryId" ? "GB" : "mobile"], metrics: [path ? 1 : 2] },
        ],
      );
    default:
      throw new Error("Unexpected GA4 report dimension");
  }
}

function localGa4Body(body: ReportRequest): JsonValue {
  const hours = reportHours(body);

  const rows =
    reportPath(body) === "/@alice-old"
      ? []
      : [
          { hour: "2025122601", views: 100, sessions: 20, visitors: ["before-window"] },
          { hour: "2025122602", views: 4, sessions: 2, visitors: ["prior-1", "prior-2"] },
          { hour: "2026010201", views: 3, sessions: 1, visitors: ["prior-1"] },
          { hour: "2026010202", views: 4, sessions: 2, visitors: ["a", "b"] },
          { hour: "2026010801", views: 6, sessions: 2, visitors: ["b", "c"] },
          { hour: "2026010802", views: 2, sessions: 1, visitors: ["a", "d"] },
          { hour: "2026010806", views: 2, sessions: 1, visitors: ["d", "e"] },
          { hour: "2026010807", views: 100, sessions: 20, visitors: ["after-window"] },
        ].filter(({ hour }) => hours.includes(hour));

  if (!body.dimensions.length) {
    return report(
      [],
      ["totalUsers", "screenPageViews"],
      rows.length
        ? [
            {
              dimensions: [],
              metrics: [
                new Set(rows.flatMap(({ visitors }) => visitors)).size,
                rows.reduce((total, { views }) => total + views, 0),
              ],
            },
          ]
        : [],
    );
  }

  if (body.dimensions[0]?.name === "dateHour") {
    return report(
      ["dateHour"],
      ["screenPageViews", "sessions"],
      rows.map(({ hour, views, sessions }) => ({
        dimensions: [hour],
        metrics: [views, sessions],
      })),
    );
  }

  return report(
    body.dimensions.map(({ name }) => name),
    body.metrics.map(({ name }) => name),
    [],
  );
}

// Route imports wait until auth, database and upstream mocks are installed.
async function getRoute(route: "user" | "admin") {
  return route === "user"
    ? serverHandler((await import("@/app/routes/api/analytics/stats")).Route, "GET")
    : serverHandler((await import("@/app/routes/api/admin/analytics")).Route, "GET");
}

function request(route: "user" | "admin", timezone?: string): Request {
  const search = new URLSearchParams({ period: "7d" });

  if (timezone !== undefined) search.set("tz", timezone);

  return new Request(
    `https://clickfolio.me/api/${route === "user" ? "analytics/stats" : "admin/analytics"}?${search}`,
  );
}

const DAILY = [
  { date: "2026-01-02", views: 0, unique: 0 },
  { date: "2026-01-03", views: 0, unique: 0 },
  { date: "2026-01-04", views: 0, unique: 0 },
  { date: "2026-01-05", views: 0, unique: 0 },
  { date: "2026-01-06", views: 0, unique: 0 },
  { date: "2026-01-07", views: 6, unique: 3 },
  { date: "2026-01-08", views: 15, unique: 6 },
];

describe("GA4 analytics routes", () => {
  it("builds matching-property user totals, daily sessions and breakdowns across exact current/old paths", async () => {
    const { reports, fetchMock } = stubGa4((body) => json(ga4Body(body)));
    const GET = await getRoute("user");
    const response = await GET(request("user", "America/Chicago"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual({
      totalViews: 21,
      uniqueVisitors: 8,
      viewsByDay: DAILY.map(({ date, views, unique }) => ({ date, views, uniques: unique })),
      topReferrers: [
        { referrer: "news.example", count: 5 },
        { referrer: "careers.example", count: 2 },
      ],
      directVisits: 14,
      deviceBreakdown: [
        { device: "desktop", count: 6 },
        { device: "mobile", count: 2 },
      ],
      countryBreakdown: [
        { country: "US", count: 6 },
        { country: "GB", count: 2 },
      ],
      period: "7d",
    });
    expect(reports).toHaveLength(10);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/token"))).toHaveLength(1);

    for (const path of ["/@alice", "/@alice-old"]) {
      const pathReports = reports.filter((body) => reportPath(body) === path);

      expect(pathReports).toHaveLength(5);

      for (const body of pathReports) {
        expect(body.dimensionFilter).toEqual({
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: path, caseSensitive: true },
          },
        });
        expect(body.dateRanges).toEqual(
          body.dimensions.length ? [CURRENT_RANGE] : [CURRENT_RANGE, PREVIOUS_RANGE],
        );
      }

      expect(
        pathReports.map((body) => ({ dimensions: body.dimensions, metrics: body.metrics })),
      ).toEqual(
        expect.arrayContaining([
          { dimensions: [], metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }] },
          {
            dimensions: [{ name: "date" }],
            metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
          },
          { dimensions: [{ name: "pageReferrer" }], metrics: [{ name: "totalUsers" }] },
          { dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "totalUsers" }] },
          { dimensions: [{ name: "countryId" }], metrics: [{ name: "totalUsers" }] },
        ]),
      );
    }
  });

  it("builds the matching-property admin dashboard with comparison, profile paths and domain aggregation", async () => {
    const { reports } = stubGa4((body) => json(ga4Body(body)));
    const GET = await getRoute("admin");
    const response = await GET(request("admin", "America/Chicago"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=30, stale-while-revalidate=60",
    );
    expect(await response.json()).toEqual({
      totals: { views: 21, unique: 8, avgPerDay: 3, profilesViewed: 2 },
      changes: { views: 50, unique: 100, avgPerDay: 50 },
      daily: DAILY,
      topProfiles: [
        { handle: "alice", views: 14 },
        { handle: "bob", views: 7 },
      ],
      referrers: [
        { domain: "news.example", count: 5, percent: 83 },
        { domain: "careers.example", count: 1, percent: 17 },
      ],
      countries: [
        { code: "US", name: "US", percent: 75 },
        { code: "GB", name: "GB", percent: 25 },
      ],
      devices: [
        { type: "desktop", percent: 75 },
        { type: "mobile", percent: 25 },
      ],
    });
    expect(reports).toHaveLength(6);

    for (const body of reports) {
      expect(body.dimensionFilter).toBeUndefined();
      expect(body.dateRanges).toEqual(
        body.dimensions.length ? [CURRENT_RANGE] : [CURRENT_RANGE, PREVIOUS_RANGE],
      );
    }

    expect(reports.find((body) => body.dimensions[0]?.name === "pagePath")).toMatchObject({
      metrics: [{ name: "screenPageViews" }],
      limit: "50",
      orderBys: [
        { metric: { metricName: "screenPageViews" }, desc: true },
        { dimension: { dimensionName: "pagePath" } },
      ],
    });
    expect(reports.find((body) => body.dimensions[0]?.name === "countryId")).toMatchObject({
      metrics: [{ name: "totalUsers" }],
      limit: "10",
    });
  });

  it.each([
    ["user", "America/Los_Angeles"],
    ["admin", "America/Los_Angeles"],
    ["user", "UTC"],
    ["admin", "UTC"],
  ] as const)(
    "groups Chicago hours into viewer dates and filters both windows for %s in %s",
    async (route, timezone) => {
      const { reports } = stubGa4((body) => json(localGa4Body(body)));
      const GET = await getRoute(route);
      const response = await GET(request(route, timezone));
      const utc = timezone === "UTC";
      const views = utc ? 17 : 14;
      const visitors = utc ? 6 : 5;

      const daily = [
        { date: "2026-01-02", views: utc ? 7 : 4, unique: utc ? 3 : 2 },
        { date: "2026-01-03", views: 0, unique: 0 },
        { date: "2026-01-04", views: 0, unique: 0 },
        { date: "2026-01-05", views: 0, unique: 0 },
        { date: "2026-01-06", views: 0, unique: 0 },
        { date: "2026-01-07", views: utc ? 0 : 6, unique: utc ? 0 : 2 },
        { date: "2026-01-08", views: utc ? 10 : 4, unique: utc ? 4 : 2 },
      ];

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        route === "user"
          ? {
              totalViews: views,
              uniqueVisitors: visitors,
              viewsByDay: daily.map(({ date, views, unique }) => ({
                date,
                views,
                uniques: unique,
              })),
              topReferrers: [],
              directVisits: views,
              deviceBreakdown: [],
              countryBreakdown: [],
              period: "7d",
            }
          : {
              totals: { views, unique: visitors, avgPerDay: 2, profilesViewed: 0 },
              changes: utc
                ? { views: -84, unique: 100, avgPerDay: -87 }
                : { views: 100, unique: 150, avgPerDay: 100 },
              daily,
              topProfiles: [],
              referrers: [],
              countries: [],
              devices: [],
            },
      );

      // Synthetic UTC values enumerate Chicago wall-clock labels, not UTC report hours.
      const hourKeys = (propertyStartAt: number, count: number) =>
        Array.from({ length: count }, (_, index) =>
          new Date(propertyStartAt + index * 60 * 60 * 1000)
            .toISOString()
            .replace(/\D/g, "")
            .slice(0, 10),
        );

      const currentHours = utc
        ? hourKeys(Date.UTC(2026, 0, 1, 18), 157)
        : hourKeys(Date.UTC(2026, 0, 2, 2), 149);

      const previousHours = utc
        ? hourKeys(Date.UTC(2025, 11, 25, 18), 168)
        : hourKeys(Date.UTC(2025, 11, 26, 2), 168);

      const currentRange = utc ? { startDate: "2026-01-01", endDate: "2026-01-08" } : CURRENT_RANGE;

      const previousRange = utc
        ? { startDate: "2025-12-25", endDate: "2026-01-01" }
        : { startDate: "2025-12-26", endDate: "2026-01-02" };

      const pathCount = route === "user" ? 2 : 1;
      const aggregateReports = reports.filter((body) => !body.dimensions.length);

      expect(reports).toHaveLength(route === "user" ? 12 : 7);
      expect(aggregateReports).toHaveLength(pathCount * 2);
      expect(
        aggregateReports.filter((body) => reportHours(body)[0] === currentHours[0]),
      ).toHaveLength(pathCount);
      expect(
        aggregateReports.filter((body) => reportHours(body)[0] === previousHours[0]),
      ).toHaveLength(pathCount);
      expect(reports.filter((body) => body.dimensions[0]?.name === "dateHour")).toHaveLength(
        pathCount,
      );

      for (const body of reports) {
        const previous = body.dateRanges[0]?.startDate === previousRange.startDate;

        const hourFilter = {
          filter: {
            fieldName: "dateHour",
            inListFilter: { values: previous ? previousHours : currentHours },
          },
        };

        expect(body.dateRanges).toEqual([previous ? previousRange : currentRange]);

        if (previous) expect(body.dimensions).toEqual([]);

        if (route === "user") {
          const path = reportPath(body);

          expect(["/@alice", "/@alice-old"]).toContain(path);
          expect(body.dimensionFilter).toEqual({
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: "pagePath",
                    stringFilter: { matchType: "EXACT", value: path, caseSensitive: true },
                  },
                },
                hourFilter,
              ],
            },
          });
        } else {
          expect(body.dimensionFilter).toEqual(hourFilter);
        }
      }
    },
  );

  it.each(["user", "admin"] as const)(
    "returns identical UTC traffic and report windows for omitted or invalid tz for %s",
    async (route) => {
      const { reports } = stubGa4((body) => json(localGa4Body(body)));
      const GET = await getRoute(route);
      const utcResponse = await GET(request(route, "UTC"));

      expect(utcResponse.status).toBe(200);
      const utcBody: JsonValue = await utcResponse.json();
      const utcReports = reports.splice(0);

      for (const timezone of [undefined, "Mars/Olympus"]) {
        const response = await GET(request(route, timezone));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(utcBody);
        expect(reports).toHaveLength(utcReports.length);
        expect(reports.splice(0)).toEqual(expect.arrayContaining(utcReports));
      }
    },
  );

  it.each(["user", "admin"] as const)(
    "returns zero traffic without inventing GA4 rows for %s",
    async (route) => {
      stubGa4((body) =>
        json({
          dimensionHeaders: body.dimensions,
          metricHeaders: body.metrics,
          rowCount: 0,
          metadata: { timeZone: "America/Chicago" },
        }),
      );
      const GET = await getRoute(route);
      const response = await GET(request(route));

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject(
        route === "user"
          ? {
              totalViews: 0,
              uniqueVisitors: 0,
              directVisits: 0,
              viewsByDay: DAILY.map(({ date }) => ({ date, views: 0, uniques: 0 })),
              topReferrers: [],
              deviceBreakdown: [],
              countryBreakdown: [],
            }
          : {
              totals: { views: 0, unique: 0, avgPerDay: 0, profilesViewed: 0 },
              changes: { views: 0, unique: 0, avgPerDay: 0 },
              daily: DAILY.map(({ date }) => ({ date, views: 0, unique: 0 })),
              topProfiles: [],
              referrers: [],
              countries: [],
              devices: [],
            },
      );
    },
  );

  it.each(["user", "admin"] as const)(
    "maps malformed GA4 reports to the standard 502 for %s",
    async (route) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      stubGa4(() =>
        json({ metricHeaders: [], rows: [], metadata: { timeZone: "America/Chicago" } }),
      );
      const GET = await getRoute(route);
      const response = await GET(request(route));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: "The service returned an unexpected response. Please try again.",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    },
  );

  it.each(["user", "admin"] as const)(
    "rejects missing or mismatched property metadata without leaking report details for %s",
    async (route) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const GET = await getRoute(route);

      for (const timeZone of [undefined, "UTC"]) {
        stubGa4((body) => {
          const reportBody = {
            dimensionHeaders: body.dimensions,
            metricHeaders: body.metrics,
            rowCount: 0,
          };

          if (timeZone === undefined) return json(reportBody);

          return json({ ...reportBody, metadata: { timeZone } });
        });
        const response = await GET(request(route));

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({
          error: "The service returned an unexpected response. Please try again.",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }
    },
  );

  it("maps a GA4 backend outage to the existing upstream-unavailable response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubGa4(() => json({}, 503));
    const GET = await getRoute("admin");
    const response = await GET(request("admin"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "The service is temporarily unavailable. Please try again.",
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("fails an unknown analytics source without silently querying another backend", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.env.ANALYTICS_SOURCE = "unsupported";
    const { fetchMock } = stubGa4((body) => json(ga4Body(body)));
    const GET = await getRoute("admin");
    const response = await GET(request("admin"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "An unexpected error occurred. Please try again.",
      code: "INTERNAL_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
