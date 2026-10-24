/**
 * Routes stay `export async function METHOD(req) { return withUserEffect(req, (ctx) => … }`.
 */

import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { authenticateAdmin, type AdminUser } from "@/lib/auth/admin";
import { authenticate, type AuthenticatedUser } from "@/lib/auth/clerk";
import { runRoute } from "@/lib/effect/edges";
import type { ServerFailure } from "@/lib/effect/failures";
import { appLayer, type AppServices } from "@/lib/effect/layers";

const DEFAULT_UNAUTHORIZED_MESSAGE = "You must be logged in";

// The handler is an Effect: it reads Postgres through the `Db` service and fails with a tagged
// error instead of building a Response for each failure. Services a route needs beyond these
// join `appLayer`, or are provided inside the handler.

export function withUserEffect(
  request: Request | undefined,
  handler: (context: AuthenticatedUser) => Effect.Effect<Response, ServerFailure, AppServices>,
  unauthorizedMessage: string = DEFAULT_UNAUTHORIZED_MESSAGE,
): Promise<Response> {
  const program = authenticate({ unauthorizedMessage }).pipe(Effect.flatMap(handler));

  return runRoute(request, program, appLayer(env));
}

export function withAdminEffect(
  request: Request | undefined,
  handler: (context: { user: AdminUser }) => Effect.Effect<Response, ServerFailure, AppServices>,
): Promise<Response> {
  const program = authenticateAdmin().pipe(Effect.flatMap((user) => handler({ user })));

  return runRoute(request, program, appLayer(env));
}
