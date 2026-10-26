/**
 * Start instance. Defining it replaces Start's default request middleware, which checks only
 * server functions for cross-site requests; this one also checks every non-GET/HEAD request,
 * covering the cookie-authenticated `app/routes/api/` mutations. The check accepts
 * `Sec-Fetch-Site: same-origin`, else an `Origin` (or `Referer`) equal to the request's origin,
 * and answers 403 otherwise, including when all three headers are missing.
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
 */
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

/** Server-to-server callback: no browser headers, authenticated by its Svix signature. */
const CLERK_WEBHOOK_PATH = "/api/webhooks/clerk";

/** Which requests must prove they came from this origin. Exported for tests. */
export function needsOriginCheck({
  handlerType,
  request,
  pathname,
}: {
  handlerType: "serverFn" | "router";
  request: Request;
  pathname: string;
}): boolean {
  if (handlerType === "serverFn") return true;

  return request.method !== "GET" && request.method !== "HEAD" && pathname !== CLERK_WEBHOOK_PATH;
}

const csrfMiddleware = createCsrfMiddleware({ filter: needsOriginCheck });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
