/**
 * Authentication middleware utilities for API routes.
 * Provides reusable authentication helpers.
 *
 * Session resolution is Clerk-backed: `requireAuthClerk()` (lib/auth/clerk.ts)
 * verifies the `__session` JWT and maps it to the local Postgres user row via
 * `user.clerk_id`.
 */
import { requireAuthClerk, type AuthUser, type DbUser } from "@/lib/auth/clerk";
import type { Database } from "@/lib/db";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export type { AuthUser, DbUser };

/**
 * Helper to require authentication with custom error message
 *
 * @param errorMessage Custom error message for unauthorized access
 * @returns Promise containing either the authenticated user or an error response
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const { user, error } = await requireAuthWithMessage("Must be logged in to view this");
 *   if (error) return error;
 *
 *   // user is guaranteed to be defined here
 *   return Response.json({ userId: user.id });
 * }
 * ```
 */
export async function requireAuthWithMessage(
  errorMessage: string,
): Promise<{ user: AuthUser; error: null } | { user: null; error: Response }> {
  const authResult = await requireAuthClerk(errorMessage);
  if (authResult.error) {
    return {
      user: null,
      error: authResult.error,
    };
  }
  return { user: authResult.user, error: null };
}

/**
 * Helper to require authentication AND validate user exists in database.
 * This protects against sessions pointing at users that have no local row
 * (e.g. Clerk webhook not yet processed, or deleted accounts).
 *
 * Fetches Cloudflare env internally and returns it alongside the Hyperdrive
 * db handle, so callers do not need a separate env import. `user.id` is the
 * app/legacy Postgres user id; `dbUser.clerkId` carries the Clerk identity.
 *
 * @param errorMessage Custom error message for unauthorized access
 * @returns Promise containing either auth data + db + env + user record, or error response
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   const { user, db, dbUser, env, error } = await requireAuthWithUserValidation(
 *     "Must be logged in",
 *   );
 *   if (error) return error;
 *
 *   // user, db, env, and dbUser are guaranteed to be defined here
 *   await db.insert(table).values({ userId: user.id });
 * }
 * ```
 */
export async function requireAuthWithUserValidation(errorMessage: string): Promise<
  | {
      user: AuthUser;
      db: Database;
      dbUser: DbUser;
      env: CloudflareEnv;
      error: null;
    }
  | {
      user: null;
      db: null;
      dbUser: null;
      env: null;
      error: Response;
    }
> {
  return requireAuthClerk(errorMessage);
}

/**
 * Helper to require cron authentication for manual trigger endpoints.
 * Fail-closed: rejects all requests when CRON_SECRET is not configured.
 *
 * @returns null if the request is authorized, or an error Response if not
 *
 * @example
 * ```ts
 * import { env } from "cloudflare:workers";
 *
 * export async function GET(request: Request) {
 *   const authError = requireCronAuth(request, env);
 *   if (authError) return authError;
 *   // ... run cron task
 * }
 * ```
 */
export function requireCronAuth(request: Request, env: CloudflareEnv): Response | null {
  type CronEnv = CloudflareEnv & { CRON_SECRET?: string };
  // SAFETY: CRON_SECRET is runtime env var not in CloudflareEnv type; CronEnv extends CloudflareEnv with optional CRON_SECRET, single cast bridges missing type.
  const cronSecret = (env as CronEnv).CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not configured");
    return createErrorResponse(
      "Server misconfiguration: CRON_SECRET not set",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return createErrorResponse("Unauthorized", ERROR_CODES.UNAUTHORIZED, 401);
  }

  return null;
}
