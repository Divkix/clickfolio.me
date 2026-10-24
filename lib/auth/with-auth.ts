/**
 * Routes stay `export async function METHOD(req) { return withUser(req, async (ctx) => { … }) }`
 * — the const-export form is rejected because vinext (Vite-based, not standard
 * Next.js) has unproven route detection for const-exported handlers.
 */

import { reportUnhandledError, unexpectedErrorResponse } from "@/lib/api/route";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";

type AuthedUserContext = Omit<
  Extract<Awaited<ReturnType<typeof requireAuthWithUserValidation>>, { error: null }>,
  "error"
>;

type AuthedAdminContext = Omit<
  Extract<Awaited<ReturnType<typeof requireAdminAuthForApi>>, { error: null }>,
  "error"
>;

const DEFAULT_UNAUTHORIZED_MESSAGE = "You must be logged in";

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

    return unexpectedErrorResponse();
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

    return unexpectedErrorResponse();
  }
}
