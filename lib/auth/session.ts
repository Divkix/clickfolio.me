import { env } from "cloudflare:workers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getAuthClerk } from "@/lib/auth/clerk";
import type { UserRole, User as SchemaUser } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { user as users } from "@/lib/db/schema";

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

export interface AppSession {
  user: AppSessionUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

export const getServerSession = cache(async (): Promise<AppSession | null> => {
  const auth = await getAuthClerk();
  if (!auth) return null;

  const db = getDb(env.HYPERDRIVE);
  const dbUser = await db.query.user.findFirst({
    where: eq(users.clerkId, auth.clerkId),
  });

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
