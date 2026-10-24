import { env } from "cloudflare:workers";
import { cache } from "react";
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
 * caller's job, after the Effect returns. A route passes its `request` so the token comes from
 * that request's __session cookie only; pages leave it out and read the framework's cookie store.
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
 * Page and layout entry point. A framework signal thrown while reading cookies passes through;
 * an upstream failure throws to the error boundary rather than rendering as signed out.
 */
export const getServerSession = cache((): Promise<AppSession | null> =>
  runPage(findSession(), appLayer(env)),
);
