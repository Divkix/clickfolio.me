/**
 * IP-based rate limiting for anonymous endpoints
 *
 * Uses Drizzle/D1 for persistence.
 * Hashes IPs for privacy (GDPR-friendly, no raw IPs stored).
 */

import { env } from "cloudflare:workers";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { uploadRateLimits } from "@/lib/db/schema";
import { isLocalEnvironment } from "@/lib/utils/environment";
import { sha256Hex } from "@/lib/utils/hash";

const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 50;
const HANDLE_CHECK_HOURLY_LIMIT = 100;
const EMAIL_VALIDATE_HOURLY_LIMIT = 30;

const LOCAL_IPS = new Set([
  "127.0.0.1",
  "::1",
  "localhost",
  "unknown",
  "0.0.0.0",
  "::ffff:127.0.0.1",
]);

interface IPRateLimitResult {
  allowed: boolean;
  remaining: {
    hourly: number;
    daily: number;
  };
  message?: string;
}

/**
 * Hash IP address for privacy-preserving storage
 * Uses SHA-256 which is sufficient for rate limiting (equality checks only)
 */
async function hashIP(ip: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(ip));
}

/**
 * Extract client IP from request (Cloudflare Workers)
 * CF-Connecting-IP is set by Cloudflare and cannot be spoofed by clients
 */
export function getClientIP(request: Request): string {
  // CF-Connecting-IP is authoritative on Cloudflare Workers
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // Fallback for local development
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  // Final fallback
  return "unknown";
}

/**
 * Check and record IP-based rate limit for presigned URL generation
 * Returns allowed: false if limit exceeded
 *
 * Rate limits:
 * - 10 requests per IP per hour
 * - 50 requests per IP per 24 hours
 */
export async function checkIPRateLimit(ip: string): Promise<IPRateLimitResult> {
  // Skip in development
  if (process.env.NODE_ENV !== "production") {
    return {
      allowed: true,
      remaining: { hourly: HOURLY_LIMIT, daily: DAILY_LIMIT },
    };
  }

  // Feature flag bypass for temporary testing (non-production only)
  // Note: this code only runs when NODE_ENV === "production" (the early return above
  // handles all non-production cases), so DISABLE_RATE_LIMITS is always ignored here.
  if (process.env.DISABLE_RATE_LIMITS === "true") {
    console.warn("[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  // Skip for localhost IPs or local environment (local preview runs in production mode)
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
    const db = getDb(env.CLICKFOLIO_DB);

    // Single query with conditional aggregation (saves 1 D1 roundtrip)
    // WHERE clause orders ipHash first (index prefix) for optimal index usage
    const result = await db
      .select({
        hourly: sql<number>`SUM(CASE WHEN ${uploadRateLimits.createdAt} >= ${oneHourAgo} THEN 1 ELSE 0 END)`,
        daily: sql<number>`COUNT(*)`,
      })
      .from(uploadRateLimits)
      .where(
        and(
          eq(uploadRateLimits.ipHash, ipHash), // Index prefix first
          eq(uploadRateLimits.actionType, "upload"),
          gte(uploadRateLimits.createdAt, oneDayAgo),
        ),
      );

    const hourlyCount = result[0]?.hourly ?? 0;
    const dailyCount = result[0]?.daily ?? 0;

    const hourlyRemaining = Math.max(0, HOURLY_LIMIT - hourlyCount);
    const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyCount);

    // Check hourly limit
    if (hourlyCount >= HOURLY_LIMIT) {
      return {
        allowed: false,
        remaining: { hourly: 0, daily: dailyRemaining },
        message: `Too many upload requests. Try again in an hour. (Limit: ${HOURLY_LIMIT}/hour)`,
      };
    }

    // Check daily limit
    if (dailyCount >= DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: { hourly: hourlyRemaining, daily: 0 },
        message: `Daily upload limit reached. Try again tomorrow. (Limit: ${DAILY_LIMIT}/day)`,
      };
    }

    // Record this request (insert before returning success)
    // Include expiresAt (24h TTL) for automatic cleanup via cron
    try {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await db.insert(uploadRateLimits).values({
        id: crypto.randomUUID(),
        ipHash,
        actionType: "upload",
        createdAt: now.toISOString(),
        expiresAt,
      });
    } catch (insertError) {
      console.error("Failed to record rate limit:", insertError);
      // Continue anyway - fail open for legitimate users
      // The claim endpoint has authenticated rate limiting as a second layer
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

    // SECURITY: Fail OPEN for IP rate limiting on anonymous endpoint
    // Rationale: False negatives (blocking legitimate users) are worse than
    // false positives (allowing some abuse) for anonymous onboarding.
    // The claim endpoint has authenticated rate limiting as a second layer.
    return {
      allowed: true,
      remaining: { hourly: 1, daily: 1 },
    };
  }
}

/**
 * Check and record IP-based rate limit for handle availability checks
 * Higher limit (100/hour) since it's a cheap read operation
 * Uses separate action type to not share quota with uploads
 *
 * Protects against:
 * - Handle enumeration attacks (100/hour is still limiting for scraping)
 * - DoS via rapid checks
 */
export async function checkHandleRateLimit(ip: string): Promise<IPRateLimitResult> {
  return checkHourlyActionLimit(ip, {
    actionType: "handle_check",
    limit: HANDLE_CHECK_HOURLY_LIMIT,
    blockedMessage: "Too many handle checks. Please try again later.",
    insertErrorLabel: "Failed to record handle check rate limit:",
    checkErrorLabel: "Handle rate limit check failed:",
  });
}

/**
 * Check and record IP-based rate limit for email validation checks
 * Moderate limit (30/hour) to prevent email enumeration attacks
 * Uses separate action type to not share quota with uploads or handle checks
 *
 * Protects against:
 * - Email enumeration attacks
 * - DoS via rapid validation checks
 */
export async function checkEmailValidateRateLimit(ip: string): Promise<IPRateLimitResult> {
  return checkHourlyActionLimit(ip, {
    actionType: "email_validate",
    limit: EMAIL_VALIDATE_HOURLY_LIMIT,
    blockedMessage: "Too many email validation checks. Please try again later.",
    insertErrorLabel: "Failed to record email validate rate limit:",
    checkErrorLabel: "Email validate rate limit check failed:",
  });
}

/**
 * Shared implementation for single-hourly-limit IP rate limits
 * (handle availability checks and email validation checks).
 *
 * Both actions share the same shape: skip in development, ignore
 * DISABLE_RATE_LIMITS in production, skip for local IPs/environment,
 * count actions of `actionType` in the last hour, block at `limit`,
 * otherwise record the action (1hr TTL) and fail open on any DB error.
 */
async function checkHourlyActionLimit(
  ip: string,
  options: {
    actionType: "handle_check" | "email_validate";
    limit: number;
    blockedMessage: string;
    insertErrorLabel: string;
    checkErrorLabel: string;
  },
): Promise<IPRateLimitResult> {
  const { actionType, limit, blockedMessage, insertErrorLabel, checkErrorLabel } = options;

  // Skip in development
  if (process.env.NODE_ENV !== "production") {
    return {
      allowed: true,
      remaining: { hourly: limit, daily: 1000 },
    };
  }

  // Feature flag bypass for temporary testing (non-production only)
  // Note: this code only runs when NODE_ENV === "production" (the early return above
  // handles all non-production cases), so DISABLE_RATE_LIMITS is always ignored here.
  if (process.env.DISABLE_RATE_LIMITS === "true") {
    console.warn("[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  // Skip for localhost IPs or local environment (local preview runs in production mode)
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
    const db = getDb(env.CLICKFOLIO_DB);

    // Count actions of this type in the last hour
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

    // Record this check (separate action type, not shared with uploads)
    try {
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1hr TTL
      await db.insert(uploadRateLimits).values({
        id: crypto.randomUUID(),
        ipHash,
        actionType,
        createdAt: now.toISOString(),
        expiresAt,
      });
    } catch (insertError) {
      console.error(insertErrorLabel, insertError);
      // Continue anyway - fail open for legitimate users
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

    // SECURITY: Fail OPEN - same rationale as upload rate limiting
    return {
      allowed: true,
      remaining: { hourly: 1, daily: 1 },
    };
  }
}
