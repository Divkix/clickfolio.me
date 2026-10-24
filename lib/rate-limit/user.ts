import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { and, eq, gte, sql } from "drizzle-orm";
import { type Database, getDb } from "@/lib/db";
import { handleChanges, resumes } from "@/lib/db/schema";
import { isLocalEnvironment } from "@/lib/utils/environment";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const RATE_LIMITS = {
  handle_change: { limit: 3, windowHours: 24 },
  resume_upload: {
    limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_DAY) || 5,
    windowHours: 24,
  },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;

// Accepts a transaction so quota reads run under the caller's user-row lock.
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function countHandleChangesInWindow(db: DbOrTx, userId: string): Promise<number> {
  const windowMs = RATE_LIMITS.handle_change.windowHours * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(handleChanges)
    .where(
      and(
        eq(handleChanges.userId, userId),
        gte(handleChanges.createdAt, windowStart.toISOString()),
      ),
    );

  return result[0]?.count ?? 0;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
  /** The backend could not be read; callers should fail closed with a retryable 503. */
  unavailable?: boolean;
}

const UNAVAILABLE_RETRY_SECONDS = 60;

// Never say "limit" here: the upload client reads that word as a used-up quota.
const UNAVAILABLE_MESSAGES: Record<RateLimitAction, string> = {
  handle_change: "Handle changes are temporarily unavailable. Please try again in a minute.",
  resume_upload: "Uploads are temporarily unavailable. Please try again in a minute.",
};

export async function checkRateLimit(
  userId: string,
  action: RateLimitAction,
  existingEnv?: Pick<CloudflareEnv, "HYPERDRIVE">,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const windowMs = config.windowHours * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);
  let resetAt = new Date(Date.now() + windowMs);

  try {
    const resolvedEnv = existingEnv ?? env;
    const db = getDb(resolvedEnv.HYPERDRIVE);

    let count = 0;
    let oldest: string | null | undefined;

    switch (action) {
      case "handle_change": {
        const result = await db
          .select({
            count: sql<number>`count(*)`,
            oldest: sql<string>`MIN(${handleChanges.createdAt})`,
          })
          .from(handleChanges)
          .where(
            and(
              eq(handleChanges.userId, userId),
              gte(handleChanges.createdAt, windowStart.toISOString()),
            ),
          );

        count = result[0]?.count ?? 0;
        oldest = result[0]?.oldest;
        break;
      }

      case "resume_upload": {
        const result = await db
          .select({
            count: sql<number>`count(*)`,
            oldest: sql<string>`MIN(${resumes.createdAt})`,
          })
          .from(resumes)
          .where(
            and(eq(resumes.userId, userId), gte(resumes.createdAt, windowStart.toISOString())),
          );

        count = result[0]?.count ?? 0;
        oldest = result[0]?.oldest;
        break;
      }

      default: {
        const _exhaustive: never = action;
        // SAFETY: _exhaustive is never from exhaustive switch; cast to string for error message when new action added without handler.
        throw new Error(`Unknown rate limit action: ${_exhaustive as string}`);
      }
    }

    if (oldest) {
      resetAt = new Date(new Date(oldest).getTime() + windowMs);
    }

    const allowed = count < config.limit;
    const remaining = Math.max(0, config.limit - count);

    return {
      allowed,
      remaining,
      resetAt,
      message: allowed
        ? undefined
        : `Rate limit exceeded. Maximum ${config.limit} ${action.replace("_", " ")} per ${config.windowHours} hour(s). Try again later.`,
    };
  } catch (error) {
    log("error", `Rate limit check failed for ${action}`, errorFields(error));

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + UNAVAILABLE_RETRY_SECONDS * 1000),
      unavailable: true,
      message: UNAVAILABLE_MESSAGES[action],
    };
  }
}

export async function enforceRateLimit(
  userId: string,
  action: RateLimitAction,
  env?: Pick<CloudflareEnv, "HYPERDRIVE">,
): Promise<Response | null> {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  if (process.env.DISABLE_RATE_LIMITS === "true") {
    log("warn", "[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  if (isLocalEnvironment()) {
    return null;
  }

  const result = await checkRateLimit(userId, action, env);

  if (result.unavailable) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    );

    return createErrorResponse(
      UNAVAILABLE_MESSAGES[action],
      ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      503,
      { retryAfterSeconds },
      { "Retry-After": String(retryAfterSeconds) },
    );
  }

  if (!result.allowed) {
    const { limit, windowHours } = RATE_LIMITS[action];
    const resetAt = result.resetAt.toISOString();

    return createErrorResponse(
      result.message ?? "Too many requests. Please try again later.",
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      429,
      { limit, windowHours, resetAt },
      {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": resetAt,
        "Retry-After": String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
      },
    );
  }

  return null;
}
