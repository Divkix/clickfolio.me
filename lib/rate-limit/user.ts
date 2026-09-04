import { env } from "cloudflare:workers";
import { and, eq, gte, sql } from "drizzle-orm";
import { type Database, getDb } from "@/lib/db";
import { handleChanges, resumes } from "@/lib/db/schema";
import { isLocalEnvironment } from "@/lib/utils/environment";
import { SECURITY_HEADERS } from "@/lib/utils/security-headers";

const RATE_LIMITS = {
  handle_change: { limit: 3, windowHours: 24 },
  resume_upload: {
    limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_DAY) || 5,
    windowHours: 24,
  },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;

export async function countHandleChangesInWindow(db: Database, userId: string): Promise<number> {
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
}

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
    console.error(`Rate limit check failed for ${action}:`, error);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: "Rate limiting service temporarily unavailable. Please try again in a few moments.",
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
    console.warn("[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  if (isLocalEnvironment()) {
    return null;
  }

  const result = await checkRateLimit(userId, action, env);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate Limit Exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        message: result.message,
        details: {
          limit: RATE_LIMITS[action].limit,
          windowHours: RATE_LIMITS[action].windowHours,
          resetAt: result.resetAt.toISOString(),
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...SECURITY_HEADERS,
          "X-RateLimit-Limit": String(RATE_LIMITS[action].limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": result.resetAt.toISOString(),
          "Retry-After": String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
        },
      },
    );
  }

  return null;
}
