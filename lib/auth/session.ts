import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { findUserByClerkId, resolveAuth, type AuthRow } from "@/lib/auth/clerk";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import type { ClerkFailed, DbConflict, DbFailed } from "@/lib/effect/failures";
import { appLayer } from "@/lib/effect/layers";
import type { Clerk } from "@/lib/effect/services/clerk";

export type AppSessionUser = AuthRow;

export interface AppSession {
  user: AppSessionUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * The signed-in user's session, or `null` when signed out or the user row does not exist yet.
 * Clerk or Postgres being unavailable fails instead of reading as signed out. Redirecting is the
 * caller's job, after the Effect returns. The token comes from `request`'s __session cookie, or
 * from the Start request being served when it is left out.
 */
export function findSession(
  request?: Request,
): Effect.Effect<AppSession | null, ClerkFailed | DbFailed | DbConflict, Clerk | Db> {
  return Effect.gen(function* () {
    const auth = yield* resolveAuth(request);

    if (!auth) return null;

    const dbUser = (yield* findUserByClerkId(auth.clerkId))[0];

    if (!dbUser) return null;

    return {
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        image: dbUser.image,
        handle: dbUser.handle,
        headline: dbUser.headline,
        privacySettings: dbUser.privacySettings,
        onboardingCompleted: Boolean(dbUser.onboardingCompleted),
        role: dbUser.role,
        isAdmin: Boolean(dbUser.isAdmin),
      },
      session: {
        id: auth.sessionId ?? "",
        userId: dbUser.id,
        token: auth.token,
        expiresAt: auth.claims.exp ? new Date(auth.claims.exp * 1000) : new Date(0),
      },
    };
  });
}

/**
 * Page loader entry point: an upstream failure throws to the error component rather than
 * rendering as signed out.
 */
export function getServerSession(): Promise<AppSession | null> {
  return runPage(findSession(), appLayer(env));
}
