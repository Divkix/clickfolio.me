/**
 * Same-origin ingest for browser telemetry (`@hyperdx/browser`): forwards
 * OTLP/HTTP traces and logs to the collector with the ingestion key, which
 * never ships to the client. Plain JSON exports are tagged with the visitor's
 * country from Cloudflare (`request.cf`), never the IP. Handled in the Worker
 * entry ahead of the app, so it costs no SSR, auth or DB work.
 */
import { Cause, Data, Effect, Exit, Layer } from "effect";
import { z } from "zod";
import type { JsonValue } from "../types/json";

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
  readonly response: string;
}> {}

const collectorMessageSchema = z
  .string()
  .transform((text, ctx) => {
    try {
      const value: unknown = JSON.parse(text);

      return value;
    } catch {
      // Plain-text and truncated error bodies are expected, not a second proxy failure.
      ctx.issues.push({ code: "custom", message: "not a JSON error envelope" });

      return z.NEVER;
    }
  })
  .pipe(z.object({ message: z.string() }));

/** Read only a prefix: upstream errors can echo payloads or serve an unbounded HTML page. */
async function collectorDiagnostic(response: Response, ingestKey: string): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const prefix = new Uint8Array(1024);
  let length = 0;

  try {
    while (length < prefix.length) {
      const { done, value } = await reader.read();

      if (done) break;
      const chunk = value.subarray(0, prefix.length - length);
      prefix.set(chunk, length);
      length += chunk.length;
    }
  } finally {
    await reader.cancel();
  }

  const text = new TextDecoder().decode(prefix.subarray(0, length));
  const envelope = collectorMessageSchema.safeParse(text);
  const message = (envelope.success ? envelope.data.message : text)
    .replaceAll(ingestKey, "[credential]")
    .replace(/\b(?:Basic|Bearer)\s+\S+/gi, "[credential]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'|`[^`]*`/g, "[quoted]");

  return errorFields(new Error(message))["error.message"].slice(0, 512);
}

// One POST to the collector with an explicit timeout. Nothing is retried: the browser SDK
// already resends on its own schedule, and a timed-out POST may still have landed.
function forward(url: string, init: RequestInit, ingestKey: string) {
  return externalCall({
    operation: "otel.forward",
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    run: async (signal) => {
      const response = await fetch(url, { ...init, signal });

      if (!response.ok) {
        throw new CollectorRejected({
          status: response.status,
          response: await collectorDiagnostic(response, ingestKey),
        });
      }

      // Unread bodies hold the subrequest open until GC.
      await response.body?.cancel();
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
      "upstream.response": failure.cause.response,
    });

    return;
  }

  log("error", "otel proxy upstream failed", {
    "otel.signal": otelSignal,
    kind: failure.kind,
    ...errorFields(failure.cause ?? new Error(failure.message)),
  });
}

async function forwardInBackground(
  url: string,
  otelSignal: string,
  init: RequestInit,
  ingestKey: string,
) {
  const program = forward(url, init, ingestKey).pipe(
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

/** Drop only invalid attribute values; one empty AnyValue otherwise rejects every span in v1.1.2. */
function validItems<T>(schema: z.ZodType<T>) {
  return z.array(z.unknown()).transform((items) => {
    const valid: T[] = [];

    for (const item of items) {
      const parsed = schema.safeParse(item);

      if (parsed.success) valid.push(parsed.data);
    }

    return valid;
  });
}

const wellFormedString = z.string().transform((value) => value.toWellFormed());

const int64String = z
  .string()
  .regex(/^-?\d{1,19}$/)
  .refine((value) => BigInt(value) >= -(2n ** 63n) && BigInt(value) < 2n ** 63n);

const anyValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.object({ stringValue: wellFormedString }),
    z.object({ boolValue: z.boolean() }),
    z.object({ doubleValue: z.number().finite() }),
    z.object({ intValue: int64String }),
    z.object({ intValue: z.number().finite() }).transform(({ intValue }) =>
      Number.isSafeInteger(intValue) ? { intValue } : { doubleValue: intValue },
    ),
    z.object({
      bytesValue: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
    }),
    z.object({ arrayValue: z.object({ values: validItems(anyValueSchema) }) }),
    z.object({ kvlistValue: z.object({ values: attributesSchema }) }),
  ]),
);

const attributesSchema = validItems(
  z.object({ key: wellFormedString, value: anyValueSchema }),
);

const attributeContainerSchema = z.looseObject({ attributes: attributesSchema.optional() });

const linkedSpanSchema = attributeContainerSchema.extend({
  traceId: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(),
  spanId: z.string().regex(/^[a-fA-F0-9]{16}$/).optional(),
});

const spanSchema = linkedSpanSchema.extend({
  name: wellFormedString.optional(),
  events: z.array(attributeContainerSchema.extend({ name: wellFormedString.optional() })).optional(),
  links: validItems(linkedSpanSchema).optional(),
});

// Loose objects preserve SDK fields that this compatibility boundary does not change.
const resourceEntrySchema = z.looseObject({
  resource: z
    .looseObject({ attributes: attributesSchema.default(() => []) })
    .default(() => ({ attributes: [] })),
  scopeSpans: z
    .array(
      z.looseObject({
        scope: attributeContainerSchema.optional(),
        spans: validItems(spanSchema).optional(),
      }),
    )
    .optional(),
});

const otlpExportSchema = z.looseObject({
  resourceSpans: z.array(resourceEntrySchema).optional(),
  resourceLogs: z.array(resourceEntrySchema).optional(),
});

/**
 * Repairs SDK AnyValues before the collector decodes them, then optionally adds
 * the edge country. Invalid exports and unreadable encodings still pass through
 * so the upstream diagnostic identifies failures outside this compatibility fix.
 */
function normalizeJson(body: Uint8Array<ArrayBuffer>, country?: string): Uint8Array<ArrayBuffer> {
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
  if (country) {
    const attribute = { key: COUNTRY_ATTRIBUTE, value: { stringValue: country } };

    for (const { resource } of entries) {
      resource.attributes = [
        ...resource.attributes.filter((item) => item.key !== COUNTRY_ATTRIBUTE),
        attribute,
      ];
    }
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

    body = normalizeJson(body, country.success ? country.data : undefined);
  }

  // Built from scratch: no client header (authorization, cookies) is forwarded;
  // authorization is only ever the server key.
  const headers = new Headers({
    "content-type": contentType,
    authorization: env.OTEL_BROWSER_INGEST_KEY,
  });

  if (encoding) headers.set("content-encoding", encoding);

  ctx.waitUntil(
    forwardInBackground(
      `${env.OTEL_COLLECTOR_URL.replace(/\/+$/, "")}/v1/${signal}`,
      signal,
      { method: "POST", headers, body },
      env.OTEL_BROWSER_INGEST_KEY,
    ),
  );

  return status(202);
}
