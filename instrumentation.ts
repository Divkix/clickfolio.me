/**
 * Root server instrumentation (vinext / Next.js contract).
 *
 * `onRequestError` logs unhandled request errors with their stack and routing
 * metadata; Workers observability exports the line to HyperDX. Request headers
 * and bodies are never logged.
 */
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";

interface OnRequestErrorContext {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware";
  revalidateReason?: "on-demand" | "stale" | undefined;
}

export function onRequestError(
  error: Error,
  request: { path: string; method: string },
  context: OnRequestErrorContext,
): void {
  log("error", "Unhandled request error", {
    ...errorFields(error),
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
}
