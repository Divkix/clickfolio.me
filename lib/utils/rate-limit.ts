import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { handleChanges, resumes } from "@/lib/db/schema";
import { isLocalEnvironment } from "./environment";
import { SECURITY_HEADERS } from "./security-headers";

const RATE_LIMITS = {
  handle_change: { limit: 3, windowHours: 24 },
  resume_upload: {
    limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_DAY) || 5,
    windowHours: 24,
  },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

/**
 * Checks if a user has exceeded the rate limit for a specific action
 * Uses Drizzle/D1 to count actions in the time window
 *
 * @param existingEnv - Optional pre-fetched CloudflareEnv to avoid redundant getCloudflareContext calls
 */
async function checkRateLimit(
  userId: string,
  action: RateLimitAction,
  existingEnv?: Pick<CloudflareEnv, "DB">,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const windowMs = config.windowHours * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);
  const resetAt = new Date(Date.now() + windowMs);

  try {
    const env = existingEnv ?? (await getCloudflareContext({ async: true })).env;
    const db = getDb(env.DB);

    // Determine which table and column to query based on action
    let count = 0;

    switch (action) {
      case "handle_change": {
        // Use handle_changes table for tracking handle changes
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(handleChanges)
          .where(
            and(
              eq(handleChanges.userId, userId),
              gte(handleChanges.createdAt, windowStart.toISOString()),
            ),
          );
        count = result[0]?.count ?? 0;
        break;
      }

      case "resume_upload": {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(resumes)
          .where(
            and(eq(resumes.userId, userId), gte(resumes.createdAt, windowStart.toISOString())),
          );
        count = result[0]?.count ?? 0;
        break;
      }

      default: {
        const _exhaustive: never = action;
        throw new Error(`Unknown rate limit action: ${_exhaustive}`);
      }
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

    // SECURITY: Fail closed - if we can't verify rate limits, deny the action
    // This prevents abuse during DB outages at the cost of temporary user friction
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: "Rate limiting service temporarily unavailable. Please try again in a few moments.",
    };
  }
}

/**
 * Helper function to enforce rate limits in API routes
 * Returns a Response object if rate limit is exceeded, null otherwise
 *
 * @param env - Optional pre-fetched CloudflareEnv to avoid redundant getCloudflareContext calls
 */
export async function enforceRateLimit(
  userId: string,
  action: RateLimitAction,
  env?: Pick<CloudflareEnv, "DB">,
): Promise<Response | null> {
  // Skip rate limiting in development
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  // Feature flag bypass for temporary production testing
  if (process.env.DISABLE_RATE_LIMITS === "true") {
    return null;
  }

  // Skip for local environment (local preview runs in production mode)
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
