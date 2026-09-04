import { requireAuthClerk, type AuthUser, type DbUser } from "@/lib/auth/clerk";
import type { Database } from "@/lib/db";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export async function requireAuthWithMessage(
  errorMessage: string,
): Promise<{ user: AuthUser; error: null } | { user: null; error: Response }> {
  const authResult = await requireAuthClerk(errorMessage);
  if (authResult.error) {
    return {
      user: null,
      error: authResult.error,
    };
  }
  return { user: authResult.user, error: null };
}

export async function requireAuthWithUserValidation(errorMessage: string): Promise<
  | {
      user: AuthUser;
      db: Database;
      dbUser: DbUser;
      env: CloudflareEnv;
      error: null;
    }
  | {
      user: null;
      db: null;
      dbUser: null;
      env: null;
      error: Response;
    }
> {
  return requireAuthClerk(errorMessage);
}

export function requireCronAuth(request: Request, env: CloudflareEnv): Response | null {
  type CronEnv = CloudflareEnv & { CRON_SECRET?: string };
  // SAFETY: CRON_SECRET is runtime env var not in CloudflareEnv type; CronEnv extends CloudflareEnv with optional CRON_SECRET, single cast bridges missing type.
  const cronSecret = (env as CronEnv).CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not configured");
    return createErrorResponse(
      "Server misconfiguration: CRON_SECRET not set",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return createErrorResponse("Unauthorized", ERROR_CODES.UNAUTHORIZED, 401);
  }

  return null;
}
