/**
 * The Workers runtime (nodejs_compat + global_fetch_strictly_public) cannot run
 * @clerk/nextjs middleware reliably, so auth is verified directly:
 *   - NOT `@clerk/nextjs`: its middleware/`auth()` relies on standard Next.js
 *     request plumbing that vinext's Vite-based runtime does not provide.
 *
 * Session handling is Effect-first (`resolveAuth`, `authenticate`); the Promise functions at the
 * bottom (`verifyClerkToken`, `requireAuthClerk`) exist for callers that have not moved yet.
 */

import { env } from "cloudflare:workers";
import { Cause, Effect, Exit, Layer } from "effect";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, type Database } from "@/lib/db";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runBackground } from "@/lib/effect/edges";
import {
  NotFound,
  Unauthorized,
  type ClerkFailed,
  type DbConflict,
  type DbFailed,
} from "@/lib/effect/failures";
import { Clerk, type ClerkClaims } from "@/lib/effect/services/clerk";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const CLERK_SESSION_COOKIE = "__session";

export interface ClerkAuthContext {
  userId: string;
  clerkId: string;
  sessionId: string | null;
  claims: ClerkClaims;
  token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: SchemaUser["privacySettings"];
  onboardingCompleted: boolean;
  role: SchemaUser["role"];
}

export interface DbUser {
  id: string;
  handle: string | null;
  clerkId: string;
}

export interface AuthenticatedUser {
  user: AuthUser;
  dbUser: DbUser;
}

const USER_NOT_FOUND_MESSAGE = "User account not found. Please re-authenticate.";

const DEFAULT_UNAUTHORIZED_MESSAGE = "You must be logged in";

/** A client controls this header: an undecodable value is no value, not a thrown URIError. */
function decodeCookieValue(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    if (error instanceof URIError) return null;

    throw error;
  }
}

function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");

    if (idx === -1) continue;

    if (part.slice(0, idx).trim() === name) {
      return decodeCookieValue(part.slice(idx + 1).trim());
    }
  }

  return null;
}

export function extractClerkTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const fromCookie = readCookieFromHeader(cookieHeader, CLERK_SESSION_COOKIE);

  if (fromCookie) return fromCookie;

  const authorization = request.headers.get("Authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim() || null;
  }

  return null;
}

/**
 * The session token of this request: from `request` when given, else from the framework's
 * cookie store. `cookies()` signals "this render is dynamic" by throwing; that is not an auth
 * failure, so it becomes a defect and unwinds the render untouched (edges rethrow it).
 */
function readSessionToken(request?: Request): Effect.Effect<string | null> {
  if (request) return Effect.succeed(extractClerkTokenFromRequest(request));

  return Effect.promise(async () => {
    const cookieStore = await cookies();

    return cookieStore.get(CLERK_SESSION_COOKIE)?.value ?? null;
  });
}

/**
 * The verified session of this request, or `null` when it is signed out (no token, or a token
 * that is expired or invalid). Clerk being unreachable or misconfigured fails with `ClerkFailed`.
 */
export function resolveAuth(
  request?: Request,
): Effect.Effect<ClerkAuthContext | null, ClerkFailed, Clerk> {
  return Effect.gen(function* () {
    const token = yield* readSessionToken(request);

    if (!token) return null;

    const claims = yield* Clerk.use((clerk) => clerk.verifyToken(token));

    if (!claims) return null;

    return {
      userId: claims.sub,
      clerkId: claims.sub,
      sessionId: claims.sid ?? null,
      claims,
      token,
    };
  });
}

function findAuthUserRows(clerkId: string) {
  return Db.use((service) =>
    service.query("auth.user-by-clerk-id", (db) =>
      db
        .select({
          id: userTable.id,
          email: userTable.email,
          name: userTable.name,
          image: userTable.image,
          handle: userTable.handle,
          headline: userTable.headline,
          privacySettings: userTable.privacySettings,
          onboardingCompleted: userTable.onboardingCompleted,
          role: userTable.role,
        })
        .from(userTable)
        .where(eq(userTable.clerkId, clerkId))
        .limit(1),
    ),
  );
}

export type AuthFailure = Unauthorized | NotFound | ClerkFailed | DbFailed | DbConflict;

/**
 * Signed-in user for an API request. `Unauthorized` when signed out; `NotFound` when the JWT is
 * valid but the user row is missing (webhook lag), which callers treat as an auth failure.
 */
export function authenticate(
  options: { readonly unauthorizedMessage?: string } = {},
): Effect.Effect<AuthenticatedUser, AuthFailure, Clerk | Db> {
  return Effect.gen(function* () {
    const auth = yield* resolveAuth();

    if (!auth) {
      return yield* Effect.fail(
        new Unauthorized({ message: options.unauthorizedMessage ?? DEFAULT_UNAUTHORIZED_MESSAGE }),
      );
    }

    const rows = yield* findAuthUserRows(auth.clerkId);
    const row = rows[0];

    if (!row) {
      return yield* Effect.fail(new NotFound({ message: USER_NOT_FOUND_MESSAGE }));
    }

    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        image: row.image,
        handle: row.handle,
        headline: row.headline,
        privacySettings: row.privacySettings,
        onboardingCompleted: Boolean(row.onboardingCompleted),
        role: row.role,
      },
      dbUser: { id: row.id, handle: row.handle, clerkId: auth.clerkId },
    };
  });
}

// --- Promise API for callers that have not moved to the Effect entry points yet ---------------
// Each runs through `runBackground`, so framework signals and typed failures behave the same
// as on the Effect path. Remove with `withUser` once every route uses `withUserEffect`.

function clerkLayer(): Layer.Layer<Clerk> {
  return Clerk.layer(env);
}

/**
 * Claims of a valid token, `null` for an expired or invalid one. Clerk or its key set being
 * unavailable (or the secret key missing) throws the `ClerkFailed` instead of reporting a
 * sign-out. Used by the Worker's WebSocket upgrade.
 */
export async function verifyClerkToken(token: string): Promise<ClerkClaims | null> {
  const exit = await runBackground(
    Clerk.use((clerk) => clerk.verifyToken(token)),
    clerkLayer(),
  );

  if (Exit.isSuccess(exit)) return exit.value;

  throw Cause.squash(exit.cause);
}

type RequireAuthResult =
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
    };

function denied(error: Response): RequireAuthResult {
  return { user: null, db: null, dbUser: null, env: null, error };
}

export async function requireAuthClerk(errorMessage: string): Promise<RequireAuthResult> {
  const db = getDb(env.HYPERDRIVE);

  const exit = await runBackground(
    authenticate({ unauthorizedMessage: errorMessage }),
    Layer.mergeAll(Db.layerFrom(db), clerkLayer()),
  );

  if (Exit.isSuccess(exit)) {
    return { ...exit.value, db, env, error: null };
  }

  const failure = Cause.squash(exit.cause);

  if (failure instanceof Unauthorized) {
    return denied(createErrorResponse(failure.message, ERROR_CODES.UNAUTHORIZED, 401));
  }

  if (failure instanceof NotFound) {
    return denied(createErrorResponse(failure.message, ERROR_CODES.NOT_FOUND, 404));
  }

  throw failure;
}
