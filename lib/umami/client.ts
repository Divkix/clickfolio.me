/**
 * Umami Analytics API client for self-hosted instance.
 *
 * Auth: JWT via POST /api/auth/login. Token cached module-level
 * for 1 hour, auto-cleared on 401 with single retry.
 *
 * Runs on Cloudflare Workers — env vars from CloudflareEnv binding.
 *
 * Compatible with Umami v2.12+ API format:
 * - Stats return flat numbers + comparison object
 * - Metrics require unit + timezone, type "url" renamed to "path"
 * - Filters use simple query params (e.g. path=/@handle)
 */

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 5_000; // 5 seconds

// Module-level token cache (reset per isolate lifetime)
let cachedToken: string | null = null;
let tokenTimestamp = 0;

// --- Types ---

/** Umami v2.12+ stats response — flat numbers with comparison object. */
export interface UmamiStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  comparison: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
  };
}

/** Time-series pageviews and sessions data from Umami. */
export interface UmamiPageviews {
  /** Array of { timestamp, count } points for pageviews. */
  pageviews: Array<{ x: string; y: number }>;
  /** Array of { timestamp, count } points for sessions. */
  sessions: Array<{ x: string; y: number }>;
}

/** Single metric dimension (e.g., URL, referrer, country) with its count. */
export interface UmamiMetric {
  /** The metric dimension value (e.g., URL path, referrer domain). */
  x: string;
  /** The count or value for this dimension. */
  y: number;
}

interface StatsOptions {
  startAt: number;
  endAt: number;
  /** Filter by URL path (e.g. "/@handle") */
  path?: string;
}

interface PageviewsOptions {
  startAt: number;
  endAt: number;
  unit: string;
  timezone: string;
  /** Filter by URL path (e.g. "/@handle") */
  path?: string;
}

interface MetricsOptions {
  startAt: number;
  endAt: number;
  type: string;
  unit: string;
  timezone: string;
  /** Filter by URL path (e.g. "/@handle") */
  path?: string;
  limit?: number;
}

// --- Auth ---

function clearTokenCache() {
  cachedToken = null;
  tokenTimestamp = 0;
}

/**
 * Fetches and caches a JWT token for the Umami API.
 *
 * Tokens are cached module-level for TOKEN_TTL_MS (1 hour) to avoid
 * repeated logins. On 401 responses, the cache is cleared and a single
 * retry is attempted automatically.
 *
 * @param env - Cloudflare environment bindings with Umami credentials
 * @returns JWT token string for Bearer authorization
 */
export async function getUmamiToken(env: CloudflareEnv): Promise<string> {
  if (cachedToken && Date.now() - tokenTimestamp < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const apiUrl = env.UMAMI_API_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: env.UMAMI_USERNAME,
        password: env.UMAMI_PASSWORD,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Umami auth failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { token: string };
    cachedToken = data.token;
    tokenTimestamp = Date.now();
    return cachedToken;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Internal helpers ---

/** Append path filter as a simple query param (Umami v2.12+ format). */
function appendPathFilter(params: URLSearchParams, path?: string) {
  if (path) {
    params.set("path", path);
  }
}

/**
 * Internal authenticated GET helper for the Umami API.
 *
 * Handles token injection, request timeouts, and automatic token
 * refresh on 401 with a single retry. Throws on non-OK status.
 *
 * @param env - Cloudflare environment bindings
 * @param path - Umami API endpoint path (e.g., /api/websites/{id}/stats)
 * @param params - URL search params for the request
 * @param retry - Whether to retry once on 401 (default true)
 * @returns Parsed JSON response typed as T
 * @internal
 */
async function umamiGet<T>(
  env: CloudflareEnv,
  path: string,
  params: URLSearchParams,
  retry = true,
): Promise<T> {
  const token = await getUmamiToken(env);
  const apiUrl = env.UMAMI_API_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiUrl}${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (res.status === 401 && retry) {
      clearTokenCache();
      clearTimeout(timeout);
      return umamiGet<T>(env, path, params, false);
    }

    if (!res.ok) {
      throw new Error(`Umami API error: ${res.status} ${res.statusText} for ${path}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API ---

/**
 * Fetches aggregated stats (pageviews, visitors, visits, bounces) from Umami.
 *
 * @param env - Cloudflare environment bindings
 * @param opts - Date range and optional path filter
 * @returns Aggregated stats with comparison data
 */
export async function getStats(env: CloudflareEnv, opts: StatsOptions): Promise<UmamiStats> {
  const params = new URLSearchParams({
    startAt: opts.startAt.toString(),
    endAt: opts.endAt.toString(),
  });
  appendPathFilter(params, opts.path);

  return umamiGet<UmamiStats>(env, `/api/websites/${WEBSITE_ID}/stats`, params);
}

/**
 * Fetches time-series pageviews and sessions data from Umami.
 *
 * @param env - Cloudflare environment bindings
 * @param opts - Date range, unit, timezone, and optional path filter
 * @returns Time-series data for pageviews and sessions
 */
export async function getPageviews(
  env: CloudflareEnv,
  opts: PageviewsOptions,
): Promise<UmamiPageviews> {
  const params = new URLSearchParams({
    startAt: opts.startAt.toString(),
    endAt: opts.endAt.toString(),
    unit: opts.unit,
    timezone: opts.timezone,
  });
  appendPathFilter(params, opts.path);

  return umamiGet<UmamiPageviews>(env, `/api/websites/${WEBSITE_ID}/pageviews`, params);
}

/**
 * Fetches dimension metrics (e.g., URLs, referrers, countries) from Umami.
 *
 * @param env - Cloudflare environment bindings
 * @param opts - Date range, metric type, unit, timezone, and optional path filter
 * @returns Array of metric dimensions with their counts
 */
export async function getMetrics(env: CloudflareEnv, opts: MetricsOptions): Promise<UmamiMetric[]> {
  const params = new URLSearchParams({
    startAt: opts.startAt.toString(),
    endAt: opts.endAt.toString(),
    type: opts.type,
    unit: opts.unit,
    timezone: opts.timezone,
  });
  if (opts.limit) {
    params.set("limit", opts.limit.toString());
  }
  appendPathFilter(params, opts.path);

  return umamiGet<UmamiMetric[]>(env, `/api/websites/${WEBSITE_ID}/metrics`, params);
}
