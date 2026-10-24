import { z } from "zod";

// Plain promise client for the Umami HTTP API. The Effect layer lives in
// lib/effect/services/umami.ts, which adds the outer timeout and the tagged failure.
// Rules for this file: no Effect imports (the admin dashboard page still calls it directly),
// and a thrown error never carries the API host, a path, the website id or a token, because
// `externalCall` copies the message into logs.

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";

/** One HTTP hop (a login or a GET). The caller's outer timeout bounds the whole chain. */
const HOP_TIMEOUT_MS = 5_000;

/**
 * Per-isolate token cache: the one deliberate exception to "no module-scope token".
 * Umami's login endpoint is slow (password hash) and every dashboard load fans out into many
 * concurrent GETs; without sharing, each one would log in. Limits that keep it safe:
 * - only a validated, non-empty token string is stored (plain data, no stream or client);
 * - a failed login is never stored;
 * - the entry expires after TOKEN_TTL_MS and is dropped on a 401, only if it is still the
 *   token that was rejected;
 * - the shared login runs on its own timer, never a caller's signal, so one aborted request
 *   cannot fail the others; each caller is bounded by its own outer timeout;
 * - a shared login older than its own timeout is treated as lost (a Workers request that
 *   ended mid-login can leave its promise pending forever) and is not joined.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

const LOGIN_JOIN_WINDOW_MS = HOP_TIMEOUT_MS + 1_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

let loginInFlight: { promise: Promise<string>; startedAt: number } | null = null;

const statSchema = z.number();

const comparisonSchema = z.looseObject({
  pageviews: statSchema.optional(),
  visitors: statSchema.optional(),
  visits: statSchema.optional(),
  bounces: statSchema.optional(),
  totaltime: statSchema.optional(),
});

// Umami < 2.12 nests these as `{ value }` objects; a flat number is required on purpose so an
// old server fails loudly instead of rendering zeros.
const statsSchema = z.looseObject({
  pageviews: statSchema,
  visitors: statSchema,
  visits: statSchema.optional(),
  bounces: statSchema.optional(),
  totaltime: statSchema.optional(),
  comparison: comparisonSchema.optional(),
});

const pointSchema = z.looseObject({ x: z.string(), y: z.number() });

const pageviewsSchema = z.looseObject({
  pageviews: z.array(pointSchema),
  sessions: z.array(pointSchema),
});

// `x` is null for a direct referrer or an unknown device or country; callers treat "" the same.
const metricSchema = z.looseObject({
  x: z
    .string()
    .nullable()
    .transform((x) => x ?? ""),
  y: z.number(),
});

const metricsSchema = z.array(metricSchema);

const loginSchema = z.looseObject({ token: z.string().min(1) });

export type UmamiStats = z.infer<typeof statsSchema>;

export type UmamiPageviews = z.infer<typeof pageviewsSchema>;

export type UmamiMetric = z.infer<typeof metricSchema>;

export interface StatsOptions {
  startAt: number;
  endAt: number;
  path?: string;
}

export interface PageviewsOptions {
  startAt: number;
  endAt: number;
  unit: string;
  timezone: string;
  path?: string;
}

export interface MetricsOptions {
  startAt: number;
  endAt: number;
  type: string;
  unit: string;
  timezone: string;
  path?: string;
  limit?: number;
}

/** `status` lets the shared upstream classifier tell a 5xx (retry later) from a 4xx (give up). */
class UmamiHttpError extends Error {
  readonly status: number;

  constructor(operation: string, status: number) {
    super(`Umami ${operation} responded ${status}`);
    this.name = "UmamiHttpError";
    this.status = status;
  }
}

/** Unparseable JSON fails like a schema mismatch (ZodError), so both read as an invalid response. */
function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  const json = z.string().transform((raw, ctx) => {
    try {
      return JSON.parse(raw);
    } catch {
      ctx.issues.push({ code: "custom", message: "Response is not valid JSON", input: raw });

      return z.NEVER;
    }
  });

  return json.pipe(schema).parse(text);
}

function hopSignal(caller?: AbortSignal): AbortSignal {
  const timer = AbortSignal.timeout(HOP_TIMEOUT_MS);

  return caller ? AbortSignal.any([caller, timer]) : timer;
}

/** A transport failure with the URL scrubbed out; aborts keep their name so they classify as timeouts. */
async function send(
  operation: string,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal });
  } catch (cause) {
    const failure = new Error(`Umami ${operation} request failed`);

    if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError")) {
      failure.name = cause.name;
    }

    throw failure;
  }
}

async function requestUmamiToken(env: CloudflareEnv): Promise<string> {
  const res = await send(
    "login",
    `${env.UMAMI_API_URL}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: env.UMAMI_USERNAME,
        password: env.UMAMI_PASSWORD,
      }),
    },
    hopSignal(),
  );

  if (!res.ok) {
    throw new UmamiHttpError("login", res.status);
  }

  const { token } = parseJson(await res.text(), loginSchema);

  cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };

  return token;
}

export async function getUmamiToken(env: CloudflareEnv): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  // Concurrent cold-isolate callers share one login instead of racing.
  if (loginInFlight && now - loginInFlight.startedAt < LOGIN_JOIN_WINDOW_MS) {
    return loginInFlight.promise;
  }

  const promise = requestUmamiToken(env).finally(() => {
    if (loginInFlight?.promise === promise) loginInFlight = null;
  });

  loginInFlight = { promise, startedAt: now };

  return promise;
}

/** Drops the cache only if it still holds the rejected token; a newer login stays. */
function forgetToken(rejected: string) {
  if (cachedToken?.value === rejected) cachedToken = null;
}

function appendPathFilter(params: URLSearchParams, path?: string) {
  if (path) {
    params.set("path", path);
  }
}

async function umamiGet<T>(
  env: CloudflareEnv,
  endpoint: string,
  params: URLSearchParams,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  retry = true,
): Promise<T> {
  const token = await getUmamiToken(env);

  const res = await send(
    "request",
    `${env.UMAMI_API_URL}/api/websites/${WEBSITE_ID}/${endpoint}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
    hopSignal(signal),
  );

  if (res.status === 401 && retry) {
    forgetToken(token);

    return umamiGet(env, endpoint, params, schema, signal, false);
  }

  if (!res.ok) {
    throw new UmamiHttpError(endpoint, res.status);
  }

  return parseJson(await res.text(), schema);
}

export async function getStats(
  env: CloudflareEnv,
  opts: StatsOptions,
  signal?: AbortSignal,
): Promise<UmamiStats> {
  const params = new URLSearchParams({
    startAt: opts.startAt.toString(),
    endAt: opts.endAt.toString(),
  });

  appendPathFilter(params, opts.path);

  return umamiGet(env, "stats", params, statsSchema, signal);
}

export async function getPageviews(
  env: CloudflareEnv,
  opts: PageviewsOptions,
  signal?: AbortSignal,
): Promise<UmamiPageviews> {
  const params = new URLSearchParams({
    startAt: opts.startAt.toString(),
    endAt: opts.endAt.toString(),
    unit: opts.unit,
    timezone: opts.timezone,
  });

  appendPathFilter(params, opts.path);

  return umamiGet(env, "pageviews", params, pageviewsSchema, signal);
}

export async function getMetrics(
  env: CloudflareEnv,
  opts: MetricsOptions,
  signal?: AbortSignal,
): Promise<UmamiMetric[]> {
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

  return umamiGet(env, "metrics", params, metricsSchema, signal);
}
