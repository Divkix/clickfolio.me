import { redirect } from "next/navigation";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { getServerSession, type AppSessionUser } from "./session";

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
