import { z } from "zod";
import type {
  AnalyticsMetric,
  AnalyticsPageviews,
  AnalyticsStats,
  MetricsOptions,
  PageviewsOptions,
  StatsOptions,
} from "@/lib/analytics/types";

// Plain promises; the Analytics Effect service owns the outer timeout and tagged failures.
// The GA4 property must report in UTC. Only access tokens are cached, never reports or keys.
// Errors must not retain upstream bodies, URLs, property ids, credentials or Zod inputs.
// https://developers.google.com/identity/protocols/oauth2/service-account
// https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
// https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const HOP_TIMEOUT_MS = 5_000;
const LOGIN_JOIN_WINDOW_MS = HOP_TIMEOUT_MS + 1_000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const TOKEN_BUFFER_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_PAGE_SIZE = 250_000;
const encoder = new TextEncoder();

let cachedToken: { value: string; expiresAt: number } | null = null;
let loginInFlight: { promise: Promise<string>; startedAt: number } | null = null;

const accountSchema = z.object({ client_email: z.email(), private_key: z.string().min(1) });

const tokenSchema = z.object({
  access_token: z.string().regex(/^\S+$/),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
});

const headerSchema = z.object({ name: z.string() });

const rowSchema = z.object({
  dimensionValues: z.array(z.object({ value: z.string().default("") })).default([]),
  metricValues: z.array(
    z.object({
      value: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()),
    }),
  ),
});

const reportSchema = z.object({
  dimensionHeaders: z.array(headerSchema).default([]),
  metricHeaders: z.array(headerSchema),
  rows: z.array(rowSchema).default([]),
  rowCount: z.number().int().nonnegative().optional(),
});

type PathFilter = {
  filter: {
    fieldName: "pagePath";
    stringFilter: { matchType: "EXACT"; value: string; caseSensitive: true };
  };
};

type ReportRequest = {
  dimensions: { name: string }[];
  metrics: { name: string }[];
  dateRanges: { startDate: string; endDate: string }[];
  dimensionFilter?: PathFilter;
  orderBys?: (
    | { metric: { metricName: string }; desc: boolean }
    | {
        dimension: { dimensionName: string };
      }
  )[];
  limit?: string;
  offset?: string;
};

class Ga4HttpError extends Error {
  readonly status: number;

  constructor(operation: string, status: number) {
    super(`GA4 ${operation} responded ${status}`);
    this.name = "Ga4HttpError";
    this.status = status;
  }
}

function invalidResponse(): z.ZodError {
  return new z.ZodError([{ code: "custom", path: [], message: "GA4 response is invalid" }]);
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    // Never retain the original issues: they may contain an echoed key, token or URL.
    throw invalidResponse();
  }
}

async function requestJson<T>(
  operation: string,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const response = await fetch(url, { ...init, signal });

    if (!response.ok) throw new Ga4HttpError(operation, response.status);

    return parseJson(await response.text(), schema);
  } catch (cause) {
    if (cause instanceof Ga4HttpError) throw cause;

    if (cause instanceof z.ZodError) throw invalidResponse();

    const failure = new Error(`GA4 ${operation} request failed`);

    if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError")) {
      failure.name = cause.name;
    }

    throw failure;
  }
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function assertion(accountJson: string): Promise<string> {
  try {
    const account = accountSchema.parse(JSON.parse(accountJson));

    const pem = account.private_key
      .trim()
      .match(/^-----BEGIN PRIVATE KEY-----\s*([A-Za-z0-9+/=\s]+)-----END PRIVATE KEY-----$/);

    if (!pem) throw new Error("Invalid private key");

    const keyBytes = Uint8Array.from(atob(pem[1].replace(/\s/g, "")), (char) => char.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "pkcs8",
      keyBytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const iat = Math.floor(Date.now() / 1000);
    const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));

    const claims = base64Url(
      encoder.encode(
        JSON.stringify({
          iss: account.client_email,
          scope: "https://www.googleapis.com/auth/analytics.readonly",
          aud: TOKEN_URL,
          iat,
          exp: iat + 3600,
        }),
      ),
    );

    const payload = `${header}.${claims}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(payload));

    return `${payload}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    throw new Error("GA4 service account configuration is invalid");
  }
}

async function requestToken(env: CloudflareEnv) {
  // Auth has its own deadline; a dashboard request's abort must not cancel other waiters.
  const signal = AbortSignal.timeout(HOP_TIMEOUT_MS);
  const startedAt = Date.now();
  const jwt = await assertion(env.GA4_SERVICE_ACCOUNT_JSON);

  const result = await requestJson(
    "authentication",
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    },
    signal,
    tokenSchema,
  );

  return {
    value: result.access_token,
    expiresAt: startedAt + Math.min(result.expires_in * 1000, TOKEN_TTL_MS) - TOKEN_BUFFER_MS,
  };
}

async function accessToken(env: CloudflareEnv): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < cachedToken.expiresAt) return cachedToken.value;

  if (loginInFlight && now - loginInFlight.startedAt < LOGIN_JOIN_WINDOW_MS) {
    return loginInFlight.promise;
  }

  const promise = requestToken(env)
    .then((token) => {
      // An abandoned/replaced auth must not overwrite the newer flight's cache.
      if (loginInFlight?.promise === promise && Date.now() - now < LOGIN_JOIN_WINDOW_MS) {
        cachedToken = token.expiresAt > Date.now() ? token : null;
      }

      return token.value;
    })
    .finally(() => {
      if (loginInFlight?.promise === promise) loginInFlight = null;
    });

  loginInFlight = { promise, startedAt: now };

  return promise;
}

function pathFilter(path: string): PathFilter {
  return {
    filter: {
      fieldName: "pagePath",
      stringFilter: { matchType: "EXACT", value: path, caseSensitive: true },
    },
  };
}

function dateRange(opts: StatsOptions) {
  if (opts.startAt > opts.endAt) throw new Error("GA4 date range is invalid");

  return {
    startDate: new Date(opts.startAt).toISOString().slice(0, 10),
    endDate: new Date(opts.endAt).toISOString().slice(0, 10),
  };
}

async function runReport(
  env: CloudflareEnv,
  body: ReportRequest,
  signal?: AbortSignal,
  retry = true,
): Promise<z.infer<typeof reportSchema>> {
  if (!/^\d+$/.test(env.GA4_PROPERTY_ID)) throw new Error("GA4 property configuration is invalid");

  const token = await accessToken(env);
  const timer = AbortSignal.timeout(HOP_TIMEOUT_MS);
  let report: z.infer<typeof reportSchema>;

  try {
    report = await requestJson(
      "report",
      `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal ? AbortSignal.any([signal, timer]) : timer,
      reportSchema,
    );
  } catch (cause) {
    if (cause instanceof Ga4HttpError && cause.status === 401) {
      if (cachedToken?.value === token) cachedToken = null;

      if (retry) return runReport(env, body, signal, false);
    }

    throw cause;
  }

  const dimensions = body.dimensions.map(({ name }) => name);

  if (body.dateRanges.length > 1) dimensions.push("dateRange");

  const headersMatch = (headers: { name: string }[], names: string[]) =>
    headers.length === names.length &&
    names.every((name) => headers.some((header) => header.name === name));

  if (
    !headersMatch(
      report.metricHeaders,
      body.metrics.map(({ name }) => name),
    ) ||
    (!(report.rows.length === 0 && report.dimensionHeaders.length === 0) &&
      !headersMatch(report.dimensionHeaders, dimensions)) ||
    report.rows.some(
      (row) =>
        row.dimensionValues.length !== report.dimensionHeaders.length ||
        row.metricValues.length !== report.metricHeaders.length,
    ) ||
    (report.rowCount !== undefined && report.rowCount < report.rows.length)
  )
    throw invalidResponse();

  return report;
}

export async function getStats(
  env: CloudflareEnv,
  opts: StatsOptions,
  signal?: AbortSignal,
): Promise<AnalyticsStats> {
  const current = dateRange(opts);
  const start = Date.parse(current.startDate);
  const days = Date.parse(current.endDate) - start + DAY_MS;

  const report = await runReport(
    env,
    {
      dimensions: [],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      dateRanges: [current, dateRange({ startAt: start - days, endAt: start - DAY_MS })],
      dimensionFilter: opts.path === undefined ? undefined : pathFilter(opts.path),
    },
    signal,
  );

  const rangeIndex = report.dimensionHeaders.findIndex(({ name }) => name === "dateRange");
  const viewsIndex = report.metricHeaders.findIndex(({ name }) => name === "screenPageViews");
  const usersIndex = report.metricHeaders.findIndex(({ name }) => name === "totalUsers");
  const stats = { pageviews: 0, visitors: 0, comparison: { pageviews: 0, visitors: 0 } };
  const seen = new Set<string>();

  for (const row of report.rows) {
    const range = row.dimensionValues[rangeIndex].value;

    if ((range !== "date_range_0" && range !== "date_range_1") || seen.has(range)) {
      throw invalidResponse();
    }

    seen.add(range);
    const target = range === "date_range_0" ? stats : stats.comparison;

    target.pageviews = row.metricValues[viewsIndex].value;
    target.visitors = row.metricValues[usersIndex].value;
  }

  return stats;
}

export async function getPageviews(
  env: CloudflareEnv,
  opts: PageviewsOptions,
  signal?: AbortSignal,
): Promise<AnalyticsPageviews> {
  if (opts.unit !== "day" || opts.timezone !== "UTC") {
    throw new Error("GA4 reports require UTC daily intervals");
  }

  const report = await runReport(
    env,
    {
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      dateRanges: [dateRange(opts)],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: REPORT_PAGE_SIZE.toString(),
      dimensionFilter: opts.path === undefined ? undefined : pathFilter(opts.path),
    },
    signal,
  );

  const dateIndex = report.dimensionHeaders.findIndex(({ name }) => name === "date");
  const viewsIndex = report.metricHeaders.findIndex(({ name }) => name === "screenPageViews");
  const sessionsIndex = report.metricHeaders.findIndex(({ name }) => name === "sessions");
  const result: AnalyticsPageviews = { pageviews: [], sessions: [] };

  for (const row of report.rows) {
    const raw = row.dimensionValues[dateIndex].value;
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const x = `${day}T00:00:00Z`;
    const parsed = new Date(x);

    if (
      !/^\d{8}$/.test(raw) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    ) {
      throw invalidResponse();
    }

    result.pageviews.push({ x, y: row.metricValues[viewsIndex].value });
    result.sessions.push({ x, y: row.metricValues[sessionsIndex].value });
  }

  return result;
}

function referrerHost(value: string): string {
  try {
    const host = new URL(value).hostname.replace(/\.$/, "");

    return host === "clickfolio.me" || host.endsWith(".clickfolio.me") ? "" : host;
  } catch {
    return "";
  }
}

export async function getMetrics(
  env: CloudflareEnv,
  opts: MetricsOptions,
  signal?: AbortSignal,
): Promise<AnalyticsMetric[]> {
  let dimension: string;
  let metric = "totalUsers";

  switch (opts.type) {
    case "path":
      dimension = "pagePath";
      metric = "screenPageViews";
      break;
    case "referrer":
      dimension = "pageReferrer";
      break;
    case "device":
      dimension = "deviceCategory";
      break;
    case "country":
      dimension = "countryId";
      break;
    default:
      throw new Error("GA4 metric type is unsupported");
  }

  if (opts.limit !== undefined && (!Number.isSafeInteger(opts.limit) || opts.limit < 0)) {
    throw new Error("GA4 metric limit is invalid");
  }

  if (opts.limit === 0) return [];

  const referrers = opts.type === "referrer";
  const totals = new Map<string, number>();
  const dates = dateRange(opts);
  let offset = 0;

  while (true) {
    // Referrers must be exhausted before limiting: many raw URLs can share the top host.
    const limit = referrers
      ? REPORT_PAGE_SIZE
      : Math.min(REPORT_PAGE_SIZE, (opts.limit ?? Infinity) - offset);

    const report = await runReport(
      env,
      {
        dimensions: [{ name: dimension }],
        metrics: [{ name: metric }],
        dateRanges: [dates],
        orderBys: [
          { metric: { metricName: metric }, desc: true },
          { dimension: { dimensionName: dimension } },
        ],
        limit: limit.toString(),
        offset: offset ? offset.toString() : undefined,
        dimensionFilter: opts.path === undefined ? undefined : pathFilter(opts.path),
      },
      signal,
    );

    const dimensionIndex = report.dimensionHeaders.findIndex(({ name }) => name === dimension);

    for (const row of report.rows) {
      const raw = row.dimensionValues[dimensionIndex].value;
      const x = referrers ? referrerHost(raw) : raw;

      if (referrers && !x) continue;

      totals.set(x, (totals.get(x) ?? 0) + row.metricValues[0].value);
    }

    offset += report.rows.length;

    const more =
      report.rowCount !== undefined ? offset < report.rowCount : report.rows.length === limit;

    if (!more || (!referrers && opts.limit !== undefined && offset >= opts.limit)) break;

    if (report.rows.length === 0) throw invalidResponse();
  }

  const result = Array.from(totals, ([x, y]) => ({ x, y })).sort(
    (a, b) => b.y - a.y || a.x.localeCompare(b.x),
  );

  return opts.limit === undefined ? result : result.slice(0, opts.limit);
}
