/**
 * IP-based rate limiting for anonymous endpoints
 *
 * Uses Drizzle/D1 for persistence.
 * Hashes IPs for privacy (GDPR-friendly, no raw IPs stored).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { uploadRateLimits } from "@/lib/db/schema";

const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 50;

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
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const ipHash = await hashIP(ip);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Count requests in both windows in parallel
    const [hourlyResult, dailyResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(uploadRateLimits)
        .where(
          and(
            gte(uploadRateLimits.createdAt, oneHourAgo),
            sql`${uploadRateLimits.ipHash} = ${ipHash}`,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(uploadRateLimits)
        .where(
          and(
            gte(uploadRateLimits.createdAt, oneDayAgo),
            sql`${uploadRateLimits.ipHash} = ${ipHash}`,
          ),
        ),
    ]);

    const hourlyCount = hourlyResult[0]?.count ?? 0;
    const dailyCount = dailyResult[0]?.count ?? 0;

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
    try {
      await db.insert(uploadRateLimits).values({
        id: crypto.randomUUID(),
        ipHash,
        createdAt: now.toISOString(),
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
