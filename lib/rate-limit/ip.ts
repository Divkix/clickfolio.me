import { env } from "cloudflare:workers";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { uploadRateLimits } from "@/lib/db/schema";
import { isLocalEnvironment } from "@/lib/utils/environment";
import { sha256Hex } from "@/lib/utils/hash";

const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 50;
const HANDLE_CHECK_HOURLY_LIMIT = 100;

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0", "::ffff:127.0.0.1"]);

interface IPRateLimitResult {
  allowed: boolean;
  remaining: {
    hourly: number;
    daily: number;
  };
  message?: string;
}

async function hashIP(ip: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(ip));
}

async function recordRateLimitAction(
  db: Database,
  ipHash: string,
  actionType: "upload" | "handle_check",
  now: Date,
  oneHourAgo: string,
  limit: number,
  ttlMs: number,
  dailyCutoff?: string,
  dailyLimit?: number,
): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const dailyGuard =
    dailyCutoff !== undefined && dailyLimit !== undefined
      ? db.$client` AND (SELECT COUNT(*) FROM upload_rate_limits
       WHERE ip_hash = ${ipHash} AND action_type = ${actionType} AND created_at >= ${dailyCutoff}) < ${dailyLimit}`
      : db.$client``;
  const result = await db.$client`
    INSERT INTO upload_rate_limits (id, ip_hash, action_type, created_at, expires_at)
    SELECT ${crypto.randomUUID()}, ${ipHash}, ${actionType}, ${now.toISOString()}, ${expiresAt}
    WHERE (SELECT COUNT(*) FROM upload_rate_limits
           WHERE ip_hash = ${ipHash} AND action_type = ${actionType} AND created_at >= ${oneHourAgo}) < ${limit}${dailyGuard}`;

  return result.count === 1;
}

export function getClientIP(request: Request): string {
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

export async function checkIPRateLimit(ip: string): Promise<IPRateLimitResult> {
  if (process.env.NODE_ENV !== "production") {
    return {
      allowed: true,
      remaining: { hourly: HOURLY_LIMIT, daily: DAILY_LIMIT },
    };
  }

  if (process.env.DISABLE_RATE_LIMITS === "true") {
    console.warn("[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  if (LOCAL_IPS.has(ip) || isLocalEnvironment()) {
    return {
      allowed: true,
      remaining: { hourly: HOURLY_LIMIT, daily: DAILY_LIMIT },
    };
  }

  const ipHash = await hashIP(ip);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const db = getDb(env.HYPERDRIVE);

    const result = await db
      .select({
        hourly: sql<number>`SUM(CASE WHEN ${uploadRateLimits.createdAt} >= ${oneHourAgo} THEN 1 ELSE 0 END)`,
        daily: sql<number>`COUNT(*)`,
      })
      .from(uploadRateLimits)
      .where(
        and(
          eq(uploadRateLimits.ipHash, ipHash),
          eq(uploadRateLimits.actionType, "upload"),
          gte(uploadRateLimits.createdAt, oneDayAgo),
        ),
      );

    const hourlyCount = result[0]?.hourly ?? 0;
    const dailyCount = result[0]?.daily ?? 0;

    const hourlyRemaining = Math.max(0, HOURLY_LIMIT - hourlyCount);
    const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyCount);

    if (hourlyCount >= HOURLY_LIMIT) {
      return {
        allowed: false,
        remaining: { hourly: 0, daily: dailyRemaining },
        message: `Too many upload requests. Try again in an hour. (Limit: ${HOURLY_LIMIT}/hour)`,
      };
    }

    if (dailyCount >= DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: { hourly: hourlyRemaining, daily: 0 },
        message: `Daily upload limit reached. Try again tomorrow. (Limit: ${DAILY_LIMIT}/day)`,
      };
    }

    try {
      const recorded = await recordRateLimitAction(
        db,
        ipHash,
        "upload",
        now,
        oneHourAgo,
        HOURLY_LIMIT,
        24 * 60 * 60 * 1000,
        oneDayAgo,
        DAILY_LIMIT,
      );

      if (!recorded) {
        return {
          allowed: false,
          remaining: { hourly: 0, daily: dailyRemaining },
          message: `Too many upload requests. Try again in an hour. (Limit: ${HOURLY_LIMIT}/hour)`,
        };
      }
    } catch (insertError) {
      console.error("Failed to record rate limit:", insertError);
    }

    return {
      allowed: true,
      remaining: {
        hourly: hourlyRemaining - 1,
        daily: dailyRemaining - 1,
      },
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);

    return {
      allowed: true,
      remaining: { hourly: 1, daily: 1 },
    };
  }
}

export async function checkHandleRateLimit(ip: string): Promise<IPRateLimitResult> {
  return checkHourlyActionLimit(ip, {
    actionType: "handle_check",
    limit: HANDLE_CHECK_HOURLY_LIMIT,
    blockedMessage: "Too many handle checks. Please try again later.",
    checkErrorLabel: "Handle rate limit check failed:",
  });
}

async function checkHourlyActionLimit(
  ip: string,
  options: {
    actionType: "handle_check";
    limit: number;
    blockedMessage: string;
    checkErrorLabel: string;
  },
): Promise<IPRateLimitResult> {
  const { actionType, limit, blockedMessage, checkErrorLabel } = options;

  if (process.env.NODE_ENV !== "production") {
    return {
      allowed: true,
      remaining: { hourly: limit, daily: 1000 },
    };
  }

  if (process.env.DISABLE_RATE_LIMITS === "true") {
    console.warn("[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  if (LOCAL_IPS.has(ip) || isLocalEnvironment()) {
    return {
      allowed: true,
      remaining: { hourly: limit, daily: 1000 },
    };
  }

  const ipHash = await hashIP(ip);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    const db = getDb(env.HYPERDRIVE);

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(uploadRateLimits)
      .where(
        and(
          eq(uploadRateLimits.ipHash, ipHash),
          eq(uploadRateLimits.actionType, actionType),
          gte(uploadRateLimits.createdAt, oneHourAgo),
        ),
      );

    const count = result[0]?.count ?? 0;

    if (count >= limit) {
      return {
        allowed: false,
        remaining: { hourly: 0, daily: 0 },
        message: blockedMessage,
      };
    }

    try {
      const recorded = await recordRateLimitAction(
        db,
        ipHash,
        actionType,
        now,
        oneHourAgo,
        limit,
        60 * 60 * 1000,
      );

      if (!recorded) {
        return {
          allowed: false,
          remaining: { hourly: 0, daily: 0 },
          message: blockedMessage,
        };
      }
    } catch (insertError) {
      console.error(`Failed to record rate limit: ${actionType}`, insertError);
    }

    return {
      allowed: true,
      remaining: {
        hourly: limit - count - 1,
        daily: 1000,
      },
    };
  } catch (error) {
    console.error(checkErrorLabel, error);

    return {
      allowed: true,
      remaining: { hourly: 1, daily: 1 },
    };
  }
}
