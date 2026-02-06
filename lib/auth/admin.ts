import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { user as users } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { getServerSession } from "./session";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

/**
 * Server-side admin auth check for pages.
 * Redirects to / if not logged in, /dashboard if not admin.
 */
export async function requireAdminAuth(): Promise<AdminUser> {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const dbUser = await db.query.user.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
    },
  });

  if (!dbUser) {
    redirect("/");
  }

  if (!dbUser.isAdmin) {
    redirect("/dashboard");
  }

  return dbUser as AdminUser;
}

/**
 * API route admin auth check.
 * Returns user or error Response.
 */
export async function requireAdminAuthForApi(): Promise<
  { user: AdminUser; error: null } | { user: null; error: Response }
> {
  const session = await getServerSession();

  if (!session?.user) {
    return {
      user: null,
      error: createErrorResponse("Unauthorized", ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const dbUser = await db.query.user.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
    },
  });

  if (!dbUser) {
    return {
      user: null,
      error: createErrorResponse("User not found", ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  if (!dbUser.isAdmin) {
    return {
      user: null,
      error: createErrorResponse("Admin access required", ERROR_CODES.FORBIDDEN, 403),
    };
  }

  return { user: dbUser as AdminUser, error: null };
}
