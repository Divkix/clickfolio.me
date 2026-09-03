import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { user as users } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { getServerSession } from "./session";

/**
 * User shape returned by admin auth checks (requireAdminAuth / requireAdminAuthForApi).
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

async function loadAdminRow(userId: string): Promise<AdminUser | null> {
  const db = getDb(env.HYPERDRIVE);
  const dbUser = await db.query.user.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, name: true, isAdmin: true },
  });
  // SAFETY: dbUser columns id,email,name,isAdmin match AdminUser shape from Drizzle query with explicit columns, safe to cast.
  return (dbUser as AdminUser) ?? null;
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

  const dbUser = await loadAdminRow(session.user.id);

  if (!dbUser) {
    redirect("/");
  }

  if (!dbUser.isAdmin) {
    redirect("/dashboard");
  }

  return dbUser;
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

  const dbUser = await loadAdminRow(session.user.id);

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

  return { user: dbUser, error: null };
}
