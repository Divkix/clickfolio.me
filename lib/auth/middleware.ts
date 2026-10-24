import { createHash, timingSafeEqual } from "node:crypto";
import { log } from "@/lib/utils/log";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

// Both sides are hashed to the same length so the comparison time reveals neither the secret
// nor its length.
function bearerMatches(authHeader: string | null, secret: string): boolean {
  const given = createHash("sha256")
    .update(authHeader ?? "")
    .digest();

  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();

  return timingSafeEqual(given, expected);
}

export function requireCronAuth(request: Request, env: CloudflareEnv): Response | null {
  type CronEnv = CloudflareEnv & { CRON_SECRET?: string };

  // SAFETY: CRON_SECRET is runtime env var not in CloudflareEnv type; CronEnv extends CloudflareEnv with optional CRON_SECRET, single cast bridges missing type.
  const cronSecret = (env as CronEnv).CRON_SECRET;

  if (!cronSecret) {
    log("error", "CRON_SECRET environment variable is not configured");

    return createErrorResponse(
      "Server misconfiguration: CRON_SECRET not set",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!bearerMatches(authHeader, cronSecret)) {
    return createErrorResponse("Unauthorized", ERROR_CODES.UNAUTHORIZED, 401);
  }

  return null;
}
