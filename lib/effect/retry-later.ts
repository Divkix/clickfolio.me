import { Effect } from "effect";
import { logFailure } from "./edges";
import type { DbConflict, DbFailed } from "./failures";
import { SECURITY_HEADERS } from "@/lib/utils/security-headers";

/**
 * For routes whose body a crawler or a cache keeps (sitemaps, social images): a failed read
 * must never be answered with a degraded 200. Logs the cause, then answers a plain-text 503
 * that tells the client to retry and that no cache layer may store.
 */
export function retryLater(path: string, message: string, retryAfterSeconds: number) {
  return (failure: DbFailed | DbConflict) =>
    Effect.sync(() => {
      logFailure(failure, { path, method: "GET" });

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
    });
}
