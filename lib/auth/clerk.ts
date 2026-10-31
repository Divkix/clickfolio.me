/**
 * Sessions are verified here with `@clerk/backend`, not `@clerk/nextjs` middleware, so this module
 * owns the rules: only the `__session` cookie counts (never `Authorization: Bearer`), an expired or
 * invalid token is signed out, and an unreachable JWKS or bad secret is `ClerkFailed`.
 *
 * Verified identities missing their row are provisioned through the same mapping as webhooks.
 * Existing users stay DB-only after token verification; no auth sleeps or retries.
 */

import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { upsertUser } from "@/lib/auth/clerk-user";
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

/** Clerk sessions accept only the __session cookie, never an Authorization header. */
export function extractClerkTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";

  return readCookieFromHeader(cookieHeader, CLERK_SESSION_COOKIE);
}

/**
 * The __session cookie only: from `request` when given (the Worker's WebSocket upgrade, which runs
 * outside TanStack Start), else from the Start request this server function or route serves.
 */
function readSessionToken(request?: Request): Effect.Effect<string | null> {
  return Effect.sync(() => extractClerkTokenFromRequest(request ?? getRequest()));
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
 * The one verified `clerk_id` → user-row lookup, shared by API and page-session auth.
 * Call only after `resolveAuth`: client-supplied ids must never provision accounts.
 */
export function findUserByClerkId(clerkId: string) {
  return Effect.gen(function* () {
    const read = Db.use((service) =>
      service.query("auth.user-by-clerk-id", (db) =>
        db.select(authUserColumns).from(userTable).where(eq(userTable.clerkId, clerkId)).limit(1),
      ),
    );

    const rows = yield* read;

    if (rows.length > 0) return rows;

    const payload = yield* Clerk.use((clerk) => clerk.getUser(clerkId));

    if (!payload) return [];

    yield* Db.use((service) =>
      service.query("auth.provision-user", (db) => upsertUser(db, payload)),
    );

    return yield* read;
  });
}

export type AuthFailure = Unauthorized | NotFound | ClerkFailed | DbFailed | DbConflict;

/**
 * Signed-in user for an API request. `Unauthorized` when signed out; `NotFound` when the JWT is
 * valid but Clerk no longer has the identity, which callers treat as an auth failure.
 */
export function authenticate(
  options: { readonly request?: Request; readonly unauthorizedMessage?: string } = {},
): Effect.Effect<AuthenticatedUser, AuthFailure, Clerk | Db> {
  return Effect.gen(function* () {
    const auth = yield* resolveAuth(options.request);

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
