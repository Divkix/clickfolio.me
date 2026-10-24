import { Effect } from "effect";
import { redirect } from "next/navigation";
import type { Db } from "@/lib/effect/db";
import {
  Forbidden,
  Unauthorized,
  type ClerkFailed,
  type DbConflict,
  type DbFailed,
} from "@/lib/effect/failures";
import type { Clerk } from "@/lib/effect/services/clerk";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { findSession, getServerSession, type AppSessionUser } from "./session";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

// getServerSession already re-reads the user row from Postgres every request, so its
// isAdmin value is as fresh as a second query and no separate lookup is needed.
function adminUserFromSession(user: AppSessionUser): AdminUser {
  return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
}

export async function requireAdminAuth(): Promise<AdminUser> {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  const adminUser = adminUserFromSession(session.user);

  if (!adminUser.isAdmin) {
    redirect("/dashboard");
  }

  return adminUser;
}

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

  const adminUser = adminUserFromSession(session.user);

  if (!adminUser.isAdmin) {
    return {
      user: null,
      error: createErrorResponse("Admin access required", ERROR_CODES.FORBIDDEN, 403),
    };
  }

  return { user: adminUser, error: null };
}

/**
 * Admin check for API routes as an Effect. `isAdmin` is read from Postgres on every call, never
 * from the token. `Unauthorized` when signed out, `Forbidden` when signed in without admin.
 */
export function authenticateAdmin(): Effect.Effect<
  AdminUser,
  Unauthorized | Forbidden | ClerkFailed | DbFailed | DbConflict,
  Clerk | Db
> {
  return Effect.gen(function* () {
    const session = yield* findSession();

    if (!session?.user) {
      return yield* Effect.fail(new Unauthorized({ message: "Unauthorized" }));
    }

    const adminUser = adminUserFromSession(session.user);

    if (!adminUser.isAdmin) {
      return yield* Effect.fail(new Forbidden({ message: "Admin access required" }));
    }

    return adminUser;
  });
}
