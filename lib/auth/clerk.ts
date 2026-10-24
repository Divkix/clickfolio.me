/**
 * The Workers runtime (nodejs_compat + global_fetch_strictly_public) cannot run
 * @clerk/nextjs middleware reliably, so auth is verified directly:
 *   - NOT `@clerk/nextjs`: its middleware/`auth()` relies on standard Next.js
 *     request plumbing that vinext's Vite-based runtime does not provide.
 *
 * Session handling is Effect-only (`resolveAuth`, `authenticate`).
 */

import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import {
  NotFound,
  Unauthorized,
  type ClerkFailed,
  type DbConflict,
  type DbFailed,
} from "@/lib/effect/failures";
import { Clerk, type ClerkClaims } from "@/lib/effect/services/clerk";

export const CLERK_SESSION_COOKIE = "__session";

export interface ClerkAuthContext {
  clerkId: string;
  sessionId: string | null;
  claims: ClerkClaims;
  token: string;
}

const authUserColumns = {
  id: userTable.id,
  email: userTable.email,
  name: userTable.name,
  image: userTable.image,
  handle: userTable.handle,
  headline: userTable.headline,
  privacySettings: userTable.privacySettings,
  onboardingCompleted: userTable.onboardingCompleted,
  role: userTable.role,
  isAdmin: userTable.isAdmin,
};

/** The user-row projection shared by API, page-session and admin auth. */
export type AuthRow = Pick<SchemaUser, Exclude<keyof typeof authUserColumns, "name">> & {
  // Auth consumers also accept accounts whose display name has not been set.
  name: string | null;
};

export type AuthUser = Omit<AuthRow, "isAdmin">;

export type DbUser = Pick<AuthRow, "id" | "handle"> & Pick<ClerkAuthContext, "clerkId">;

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
      clerkId: claims.sub,
      sessionId: claims.sid ?? null,
      claims,
      token,
    };
  });
}

/**
 * The one `clerk_id` → user-row lookup: the API (`authenticate`) and page (`findSession`) readers
 * both read their own fields from this row, so a new auth-relevant column or predicate lands
 * here once.
 */
export function findUserByClerkId(clerkId: string) {
  return Db.use((service) =>
    service.query("auth.user-by-clerk-id", (db) =>
      db.select(authUserColumns).from(userTable).where(eq(userTable.clerkId, clerkId)).limit(1),
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

    const rows = yield* findUserByClerkId(auth.clerkId);
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
