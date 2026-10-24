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
