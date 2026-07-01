/**
 * Authenticated API-route wrappers (ADR-0002: inner-callback form).
 *
 * Routes stay `export async function METHOD(req) { return withUser(req, async (ctx) => { … }) }`
 * — the const-export form is rejected because vinext (Vite-based, not standard
 * Next.js) has unproven route detection for const-exported handlers.
 *
 * `withUser` owns the three things every user-validated route used to repeat:
 *   1. the user-validation auth check (via `requireAuthWithUserValidation`),
 *   2. returning the auth-failure response directly (401/404), and
 *   3. the catch-all outer try/catch that maps an unexpected throw to a
 *      standard 500 (with the request path logged).
 *
 * Inner, purpose-specific try/catch blocks (JSON-body parsing, external-service
 * failures, unique-constraint → 409, etc.) stay in the route bodies.
 */

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

/**
 * The guaranteed-non-null context handed to a `withUser` callback: the full
 * successful result of `requireAuthWithUserValidation` minus the `error`
 * discriminant.
 */
type AuthedUserContext = Omit<
  Extract<Awaited<ReturnType<typeof requireAuthWithUserValidation>>, { error: null }>,
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

/**
 * Wrap an authenticated API route handler that requires a validated user.
 *
 * Runs `requireAuthWithUserValidation`; on failure returns its 401/404 response
 * directly without invoking `handler`. On success invokes `handler` with a
 * non-null context. Any thrown error (from the auth check or the handler) is
 * mapped to the standard 500, with the request path logged for traceability.
 *
 * @param request The incoming request (used for the 500 log line's path). May
 *   be `undefined` for a param-less GET handler invoked without one (e.g. in a
 *   unit test); the log line then falls back to a placeholder path.
 * @param handler The route body; receives a guaranteed-authenticated context.
 * @param unauthorizedMessage Optional custom 401 message for the auth failure.
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   return withUser(request, async ({ user, db }) => {
 *     return createSuccessResponse({ id: user.id });
 *   });
 * }
 * ```
 */
export async function withUser(
  request: Request | undefined,
  handler: (context: AuthedUserContext) => Response | Promise<Response>,
  unauthorizedMessage: string = DEFAULT_UNAUTHORIZED_MESSAGE,
): Promise<Response> {
  try {
    const result = await requireAuthWithUserValidation(unauthorizedMessage);
    if (result.error) return result.error;

    const { user, db, captureBookmark, dbUser, env } = result;
    return await handler({ user, db, captureBookmark, dbUser, env });
  } catch (error) {
    console.error(`Unhandled error in ${pathnameOf(request)}:`, error);
    return createErrorResponse(UNEXPECTED_ERROR_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
  }
}
