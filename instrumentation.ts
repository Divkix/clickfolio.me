/**
 * Root server instrumentation (vinext / Next.js contract).
 *
 * `onRequestError` forwards unhandled request errors to PostHog Error
 * Tracking. Only routing metadata is attached — request headers and bodies
 * never leave the Worker. vinext retains the returned promise with the
 * request execution context, so returning it keeps the send alive after the
 * response completes without a second waitUntil registration.
 */
import { captureServerException } from "@/lib/analytics/server";

interface OnRequestErrorContext {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware";
  revalidateReason?: "on-demand" | "stale" | undefined;
}

export async function onRequestError(
  error: Error,
  request: { path: string; method: string; headers?: Record<string, string> },
  context: OnRequestErrorContext,
): Promise<void> {
  return captureServerException(error, {
    request_path: request.path,
    request_method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
    router_kind: context.routerKind,
  });
}
