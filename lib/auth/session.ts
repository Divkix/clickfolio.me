import { env } from "cloudflare:workers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getAuthClerk } from "@/lib/auth/clerk";
import type { UserRole, User as SchemaUser } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { user as users } from "@/lib/db/schema";

/** App-shaped session user returned by {@link getServerSession}. */
export interface AppSessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: SchemaUser["privacySettings"];
  onboardingCompleted: boolean;
  role: UserRole | null;
  isAdmin: boolean;
}

/** App-shaped session so existing consumers stay source-compatible. */
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
 * Cached session helper for React Server Components.
 *
 * Verifies the Clerk `__session` JWT and maps the Clerk user id to the local
 * Postgres row via `user.clerk_id`, returning an app-shaped session
 * (`AppSession | null`). `user.id` is always the app/legacy Postgres user id
 * (Clerk `externalId` for imported users) — never the Clerk id.
 *
 * React's cache() ensures that multiple calls to getServerSession()
 * within the same request lifecycle return the same session object
 * without making duplicate verification/DB round-trips.
 */
export const getServerSession = cache(async (): Promise<AppSession | null> => {
  const auth = await getAuthClerk();
  if (!auth) return null;

  const db = getDb(env.HYPERDRIVE);
  const dbUser = await db.query.user.findFirst({
    where: eq(users.clerkId, auth.clerkId),
  });

  // Unknown Clerk identity (webhook not yet processed / unmapped user) is
  // treated as "no session" for RSC pages; API routes surface a 401 via
  // requireAuthClerk instead.
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
