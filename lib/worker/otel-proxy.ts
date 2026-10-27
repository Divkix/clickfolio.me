/**
 * Same-origin ingest for browser telemetry (`@hyperdx/browser`): forwards
 * OTLP/HTTP traces and logs to the collector with the ingestion key, which
 * never ships to the client. Plain JSON exports are tagged with the visitor's
 * country from Cloudflare (`request.cf`), never the IP. Handled in the Worker
 * entry ahead of the app, so it costs no SSR, auth or DB work.
 */
import { Cause, Data, Effect, Exit, Layer } from "effect";
import { z } from "zod";

import { runBackground } from "../effect/edges";
import { externalCall } from "../effect/external";
import { HttpUpstreamFailed } from "../effect/failures";
import { errorFields } from "../utils/error-fields";
import { log } from "../utils/log";
import { SECURITY_HEADERS } from "../utils/security-headers";
import { readBodyWithLimit, validateRequestSize } from "../utils/validation";

const OTEL_PROXY_PREFIX = "/otel";

const SIGNAL_PATH = new RegExp(`^${OTEL_PROXY_PREFIX}/v1/(traces|logs)$`);

const MAX_BODY_BYTES = 1024 * 1024;

const UPSTREAM_TIMEOUT_MS = 10_000;

// OTLP/HTTP encodings the SDK sends: JSON for traces, protobuf for replay logs.
const OTLP_CONTENT_TYPES = new Set(["application/json", "application/x-protobuf"]);

const COUNTRY_ATTRIBUTE = "geo.country.iso_code";

const utf8 = new TextDecoder("utf-8", { fatal: true });

const encoder = new TextEncoder();

// Optional: either can be unset (local dev, before the secret is put).
type OtelProxyEnv = { OTEL_COLLECTOR_URL?: string; OTEL_BROWSER_INGEST_KEY?: string };

export function isOtelProxyPath(pathname: string): boolean {
  return pathname === OTEL_PROXY_PREFIX || pathname.startsWith(`${OTEL_PROXY_PREFIX}/`);
}

function status(code: number, extra?: Record<string, string>): Response {
  return new Response(null, { status: code, headers: { ...SECURITY_HEADERS, ...extra } });
}

/** The collector answered, but not with a 2xx. Its `status` is what classifies the failure. */
class CollectorRejected extends Data.TaggedError("CollectorRejected")<{
  readonly status: number;
}> {}

// One POST to the collector with an explicit timeout. Nothing is retried: the browser SDK
// already resends on its own schedule, and a timed-out POST may still have landed.
function forward(url: string, init: RequestInit) {
  return externalCall({
    operation: "otel.forward",
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    run: async (signal) => {
      const response = await fetch(url, { ...init, signal });

      // Unread bodies hold the subrequest open until GC.
      await response.body?.cancel();

      if (!response.ok) throw new CollectorRejected({ status: response.status });
    },
    fail: (details) => new HttpUpstreamFailed({ ...details, host: "otel-collector" }),
    // Tracing the telemetry pipe would only add noise to the traces it carries.
    span: false,
  });
}

// Error level: the client always sees 202, so a bad key or a down collector
// shows up only here. The key itself is never logged.
function logForwardFailure(failure: HttpUpstreamFailed, otelSignal: string): void {
  if (failure.cause instanceof CollectorRejected) {
    log("error", "otel proxy upstream rejected", {
      status: failure.cause.status,
      "otel.signal": otelSignal,
    });

    return;
  }

  log("error", "otel proxy upstream failed", {
    "otel.signal": otelSignal,
    kind: failure.kind,
    ...errorFields(failure.cause ?? new Error(failure.message)),
  });
}

async function forwardInBackground(url: string, otelSignal: string, init: RequestInit) {
  const program = forward(url, init).pipe(
    Effect.catchTag("HttpUpstreamFailed", (failure) =>
      Effect.sync(() => logForwardFailure(failure, otelSignal)),
    ),
  );

  const exit = await runBackground(program, Layer.empty);

  // Typed failures are logged above; what is left is a bug, and it must not vanish.
  if (Exit.isFailure(exit)) {
    log("error", "otel proxy forward crashed", {
      "otel.signal": otelSignal,
      ...errorFields(Cause.squash(exit.cause)),
    });
  }
}

// Cloudflare's ISO 3166-1 alpha-2 country. The pattern already rejects Tor's
// "T1"; "XX" is Cloudflare's unknown-origin code.
const countrySchema = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .refine((code) => code !== "XX");

// Only the fields the tagger touches; looseObject keeps everything else as sent.
// Function defaults: the object is mutated below, so it must be fresh per parse.
const resourceEntrySchema = z.looseObject({
  resource: z
    .looseObject({ attributes: z.array(z.looseObject({ key: z.string() })).default(() => []) })
    .default(() => ({ attributes: [] })),
});

const otlpExportSchema = z.looseObject({
  resourceSpans: z.array(resourceEntrySchema).optional(),
  resourceLogs: z.array(resourceEntrySchema).optional(),
});

/**
 * Adds the visitor's country as a resource attribute on every resource of an
 * OTLP/JSON export, replacing any client-sent value. Bodies that aren't valid
 * UTF-8 OTLP JSON, or carry no resources, are returned unchanged; so is the
 * whole export when any one resource or attribute is malformed.
 */
function tagCountry(body: Uint8Array<ArrayBuffer>, country: string): Uint8Array<ArrayBuffer> {
  let json: unknown;

  try {
    json = JSON.parse(utf8.decode(body));
  } catch (error) {
    log("warn", "otel export is not JSON; forwarded without country", errorFields(error));

    return body;
  }

  const parsed = otlpExportSchema.safeParse(json);

  if (!parsed.success) {
    log("warn", "otel export is not OTLP JSON; forwarded without country", {
      issue_count: parsed.error.issues.length,
    });

    return body;
  }

  const payload = parsed.data;
  const entries = [...(payload.resourceSpans ?? []), ...(payload.resourceLogs ?? [])];

  if (entries.length === 0) return body;
  const attribute = { key: COUNTRY_ATTRIBUTE, value: { stringValue: country } };

  for (const { resource } of entries) {
    resource.attributes = [
      ...resource.attributes.filter((item) => item.key !== COUNTRY_ATTRIBUTE),
      attribute,
    ];
  }

  return encoder.encode(JSON.stringify(payload));
}

/** Handles every path under `/otel`; only `POST /otel/v1/{traces,logs}` is forwarded. */
export async function handleOtelProxy(
  request: Request,
  env: OtelProxyEnv,
  ctx: Pick<ExecutionContext, "waitUntil">,
): Promise<Response> {
  const signal = SIGNAL_PATH.exec(new URL(request.url).pathname)?.[1];

  if (!signal) return status(404);

  if (request.method !== "POST") return status(405, { Allow: "POST" });
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();

  if (!contentType || !OTLP_CONTENT_TYPES.has(contentType)) return status(415);

  // Unset secret: accept and drop, so the SDK doesn't retry or log errors.
  if (!env.OTEL_BROWSER_INGEST_KEY || !env.OTEL_COLLECTOR_URL) return status(204);

  if (!validateRequestSize(request, MAX_BODY_BYTES).valid) return status(413);
  let body: Uint8Array<ArrayBuffer> | null = new Uint8Array();

  try {
    if (request.body) body = await readBodyWithLimit(request.body, MAX_BODY_BYTES);
  } catch (error) {
    // The client went away mid-upload; nothing to forward.
    log("warn", "otel upload aborted by the client", { signal, ...errorFields(error) });

    return status(400);
  }

  if (!body) return status(413);
  const encoding = request.headers.get("content-encoding");

  // Only plain JSON is readable here; protobuf and compressed bodies pass through.
  if (contentType === "application/json" && !encoding) {
    const country = countrySchema.safeParse(request.cf?.country);

    if (country.success) body = tagCountry(body, country.data);
  }

  // Built from scratch: no client header (authorization, cookies) is forwarded.
  const headers = new Headers({
    "content-type": contentType,
    "uptrace-dsn": env.OTEL_BROWSER_INGEST_KEY,
  });

  if (encoding) headers.set("content-encoding", encoding);

  ctx.waitUntil(
    forwardInBackground(`${env.OTEL_COLLECTOR_URL.replace(/\/+$/, "")}/v1/${signal}`, signal, {
      method: "POST",
      headers,
      body,
    }),
  );

  return status(202);
}
