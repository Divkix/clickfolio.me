/**
 * Authentication middleware utilities for API routes
 * Provides reusable authentication helpers for Better Auth
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { getSessionDbWithPrimaryFirst } from "@/lib/db/session";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

/**
 * User type with Better Auth custom fields
 */
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: string;
  onboardingCompleted: boolean;
  role: SchemaUser["role"];
}

/**
 * Session type returned by Better Auth
 */
interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Helper to get the current session from Better Auth
 * Must be called within a server context (API route or server component)
 *
 * @returns The session if authenticated, null otherwise
 */
async function getSession(): Promise<AuthSession | null> {
  try {
    const auth = await getAuth();
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });
    return session as AuthSession | null;
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

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
  try {
    const session = await getSession();

    if (!session?.user) {
      return {
        user: null,
        error: createErrorResponse(errorMessage, ERROR_CODES.UNAUTHORIZED, 401),
      };
    }

    return { user: session.user, error: null };
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return {
      user: null,
      error: createErrorResponse("Authentication failed", ERROR_CODES.INTERNAL_ERROR, 500),
    };
  }
}

/**
 * Validated user record from database
 */
interface DbUser {
  id: string;
  handle: string | null;
}

/**
 * Helper to require authentication AND validate user exists in database.
 * This protects against stale sessions pointing to deleted users (e.g., after db:reset).
 *
 * Fetches Cloudflare env internally and returns it alongside the session db,
 * so callers do not need a separate getCloudflareContext() call.
 *
 * @param errorMessage Custom error message for unauthorized access
 * @returns Promise containing either auth data + db + env + user record, or error response
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   const { user, db, captureBookmark, dbUser, env, error } = await requireAuthWithUserValidation(
 *     "Must be logged in",
 *   );
 *   if (error) return error;
 *
 *   // user, db, env, and dbUser are guaranteed to be defined here
 *   await db.insert(table).values({ userId: user.id });
 *   await captureBookmark();
 * }
 * ```
 */
export async function requireAuthWithUserValidation(errorMessage: string): Promise<
  | {
      user: AuthUser;
      db: Awaited<ReturnType<typeof getSessionDbWithPrimaryFirst>>["db"];
      captureBookmark: () => Promise<void>;
      dbUser: DbUser;
      env: CloudflareEnv;
      error: null;
    }
  | {
      user: null;
      db: null;
      captureBookmark: null;
      dbUser: null;
      env: null;
      error: Response;
    }
> {
  // First validate auth session
  const authResult = await requireAuthWithMessage(errorMessage);
  if (authResult.error) {
    return {
      user: null,
      db: null,
      captureBookmark: null,
      dbUser: null,
      env: null,
      error: authResult.error,
    };
  }

  // Get Cloudflare env for D1 binding (cached per request via AsyncLocalStorage)
  const { env } = await getCloudflareContext({ async: true });

  // Create session db with primary-first consistency
  // This ensures reads/writes go to primary, avoiding FK constraint failures
  // when user record hasn't replicated to all replicas yet (post-auth flow)
  const { db, captureBookmark } = await getSessionDbWithPrimaryFirst(env.DB);

  // Validate user exists in database (protects against stale sessions)
  const userRecord = await db
    .select({ id: userTable.id, handle: userTable.handle })
    .from(userTable)
    .where(eq(userTable.id, authResult.user.id))
    .limit(1);

  if (userRecord.length === 0) {
    return {
      user: null,
      db: null,
      captureBookmark: null,
      dbUser: null,
      env: null,
      error: createErrorResponse(
        "User account not found. Please re-authenticate.",
        ERROR_CODES.NOT_FOUND,
        404,
      ),
    };
  }

  return {
    user: authResult.user,
    db,
    captureBookmark,
    dbUser: userRecord[0],
    env,
    error: null,
  };
}
