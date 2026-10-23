/**
 * Same-origin ingest for browser telemetry (`@hyperdx/browser`): forwards
 * OTLP/HTTP traces and logs to the collector with the ingestion key, which
 * never ships to the client. Handled in the Worker entry ahead of vinext, so it
 * costs no SSR, auth or DB work.
 */
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

// Optional: either can be unset (local dev, before the secret is put).
type OtelProxyEnv = { OTEL_COLLECTOR_URL?: string; OTEL_BROWSER_INGEST_KEY?: string };

export function isOtelProxyPath(pathname: string): boolean {
  return pathname === OTEL_PROXY_PREFIX || pathname.startsWith(`${OTEL_PROXY_PREFIX}/`);
}

function status(code: number, extra?: Record<string, string>): Response {
  return new Response(null, { status: code, headers: { ...SECURITY_HEADERS, ...extra } });
}

async function forward(url: string, init: RequestInit): Promise<void> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // Unread bodies hold the subrequest open until GC.
    await response.body?.cancel();

    if (!response.ok) log("warn", "otel proxy upstream rejected", { status: response.status });
  } catch (error) {
    log("warn", "otel proxy upstream failed", errorFields(error));
  }
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
  } catch {
    // The client went away mid-upload; nothing to forward.
    return status(400);
  }

  if (!body) return status(413);

  // Built from scratch: no client header (authorization, cookies) is forwarded.
  const headers = new Headers({
    "content-type": contentType,
    authorization: env.OTEL_BROWSER_INGEST_KEY,
  });

  const encoding = request.headers.get("content-encoding");

  if (encoding) headers.set("content-encoding", encoding);

  ctx.waitUntil(
    forward(`${env.OTEL_COLLECTOR_URL.replace(/\/+$/, "")}/v1/${signal}`, {
      method: "POST",
      headers,
      body,
    }),
  );

  return status(202);
}
