/**
 * Routes stay `export async function METHOD(req) { return withUser(req, async (ctx) => { … }) }`
 * — the const-export form is rejected because vinext (Vite-based, not standard
 * Next.js) has unproven route detection for const-exported handlers.
 */

import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
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
    console.error(`Unhandled error in ${pathnameOf(request)}:`, error);
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
    console.error(`Unhandled error in ${pathnameOf(request)}:`, error);
    return createErrorResponse(UNEXPECTED_ERROR_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
