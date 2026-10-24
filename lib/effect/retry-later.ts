import { Effect } from "effect";
import { logFailure } from "./edges";
import type { DbConflict, DbFailed } from "./failures";
import { SECURITY_HEADERS } from "@/lib/utils/security-headers";

/**
 * The 503 body a crawler-facing route answers: plain text that tells the client to retry and
 * that no cache layer may store. Never a degraded 200.
 */
export function retryLaterResponse(message: string, retryAfterSeconds: number) {
  return new Response(message, {
    status: 503,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/plain",
      "Retry-After": String(retryAfterSeconds),
      "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}

/**
 * For routes whose body a crawler or a cache keeps (sitemaps, social images): a failed read
 * must never be answered with a degraded 200. Pass a fixed route label, never a URL containing
 * user data. Logs the cause, then answers {@link retryLaterResponse}.
 */
export function retryLater(route: string, message: string, retryAfterSeconds: number) {
  return (failure: DbFailed | DbConflict) =>
    Effect.sync(() => {
      logFailure(failure, { path: route, method: "GET" });

      return retryLaterResponse(message, retryAfterSeconds);
    });
}
