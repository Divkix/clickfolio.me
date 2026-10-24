/**
 * Routes stay `export async function METHOD(req) { return withUser(req, async (ctx) => { … }) }`
 * — the const-export form is rejected because vinext (Vite-based, not standard
 * Next.js) has unproven route detection for const-exported handlers.
 */

import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { authenticateAdmin, requireAdminAuthForApi, type AdminUser } from "@/lib/auth/admin";
import { authenticate, type AuthenticatedUser } from "@/lib/auth/clerk";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { runRoute } from "@/lib/effect/edges";
import type { ServerFailure } from "@/lib/effect/failures";
import { appLayer, type AppServices } from "@/lib/effect/layers";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

type AuthedUserContext = Omit<
  Extract<Awaited<ReturnType<typeof requireAuthWithUserValidation>>, { error: null }>,
  "error"
>;

type AuthedAdminContext = Omit<
  Extract<Awaited<ReturnType<typeof requireAdminAuthForApi>>, { error: null }>,
  "error"
>;

const DEFAULT_UNAUTHORIZED_MESSAGE = "You must be logged in";

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

function pathnameOf(request: Request | undefined): string {
  if (!request) return "unknown path";

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

// A caught error never reaches onRequestError, so log it here (with its stack)
// to keep the 500 diagnosable in HyperDX.
function reportUnhandledError(request: Request | undefined, cause: unknown): void {
  const path = pathnameOf(request);

  log("error", "Unhandled API route error", {
    ...errorFields(cause),
    path,
    method: request?.method ?? "unknown",
  });
}

export async function withUser(
  request: Request | undefined,
  handler: (context: AuthedUserContext) => Response | Promise<Response>,
  unauthorizedMessage: string = DEFAULT_UNAUTHORIZED_MESSAGE,
): Promise<Response> {
  try {
    const result = await requireAuthWithUserValidation(unauthorizedMessage);

    if (result.error) return result.error;

    const { user, db, dbUser, env } = result;

    return await handler({ user, db, dbUser, env });
  } catch (error) {
    reportUnhandledError(request, error);

    return createErrorResponse(UNEXPECTED_ERROR_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
  }
}

export async function withAdmin(
  request: Request | undefined,
  handler: (context: AuthedAdminContext) => Response | Promise<Response>,
): Promise<Response> {
  try {
    const result = await requireAdminAuthForApi();

    if (result.error) return result.error;

    const { user } = result;

    return await handler({ user });
  } catch (error) {
    reportUnhandledError(request, error);

    return createErrorResponse(UNEXPECTED_ERROR_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
  }
}

// --- Effect entry points -----------------------------------------------------------------
// The handler is an Effect: it reads Postgres through the `Db` service and fails with a tagged
// error instead of building a Response for each failure. `withUser` / `withAdmin` above stay for
// routes that have not moved yet. Services a route needs beyond these join `appLayer`.

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
