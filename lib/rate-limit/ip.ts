import { Effect } from "effect";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { Db } from "@/lib/effect/db";
import {
  RateLimited,
  RateLimitUnavailable,
  type DbConflict,
  type DbFailed,
} from "@/lib/effect/failures";
import { rateLimitLocks, uploadRateLimits } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/utils/hash";
import { limitsBypassed } from "./bypass";
import { storeDown } from "./store-failure";

const HOURLY_LIMIT = 10;

const DAILY_LIMIT = 50;

const HANDLE_CHECK_HOURLY_LIMIT = 100;

const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

const UNKNOWN_IP = "unknown";

/** Seeded rows in `rate_limit_locks`; must match migrations_pg/0013_seed-rate-limit-locks.sql. */
const RATE_LIMIT_LOCK_SLOTS = 256;

const UPLOAD_UNAVAILABLE_MESSAGE = "Upload temporarily unavailable. Please try again in a moment.";

const HANDLE_UNAVAILABLE_MESSAGE =
  "Handle checks are temporarily unavailable. Please try again in a moment.";

type ActionType = "upload" | "handle_check";

type Remaining = { hourly: number; daily: number };

/** What the limiter decided, as data; the `...Effect` variants turn a refusal into `RateLimited`. */
type Decision =
  | { allowed: true; remaining: Remaining }
  | { allowed: false; remaining: Remaining; message: string; retryAfterSeconds: number };

type Meter = {
  actionType: ActionType;
  hourlyLimit: number;
  /** Absent for actions that only have an hourly window. */
  dailyLimit?: number;
  ttlMs: number;
};

type Metered =
  | { kind: "recorded"; hourly: number; daily: number }
  /** `oldest` is the oldest row of the full window: when it expires, a slot frees. */
  | { kind: "hourly-full"; daily: number; oldest: string | null }
  | { kind: "daily-full"; hourly: number; oldest: string | null };

const UPLOAD_METER: Meter = {
  actionType: "upload",
  hourlyLimit: HOURLY_LIMIT,
  dailyLimit: DAILY_LIMIT,
  ttlMs: DAY_MS,
};

const HANDLE_CHECK_METER: Meter = {
  actionType: "handle_check",
  hourlyLimit: HANDLE_CHECK_HOURLY_LIMIT,
  ttlMs: HOUR_MS,
};

async function hashIP(ip: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(ip));
}

/**
 * Counts this address's recent actions and records one more, in a single transaction.
 *
 * The transaction first takes a `FOR UPDATE` row lock on one of the fixed `rate_limit_locks`
 * slots (Hyperdrive does not support advisory locks) and holds it until commit. Concurrent
 * requests that hash to the same slot queue up there: the count statement follows the lock and
 * takes a fresh snapshot, so it sees every row a previous holder committed. A burst cannot read
 * the same below-limit count, and a hash collision only adds serialization.
 */
function meterAction(
  ipHash: string,
  meter: Meter,
): Effect.Effect<Metered, DbFailed | DbConflict, Db> {
  return Db.use((service) =>
    service.transaction(`rate-limit.ip.${meter.actionType}`, async (tx): Promise<Metered> => {
      const locked = await tx
        .select({ slot: rateLimitLocks.slot })
        .from(rateLimitLocks)
        .where(
          eq(
            rateLimitLocks.slot,
            sql`abs(hashtext(${`${ipHash}||${meter.actionType}`})::bigint) % ${RATE_LIMIT_LOCK_SLOTS}`,
          ),
        )
        .for("update");

      if (locked.length === 0) {
        // An unseeded slot would silently skip the lock, so refuse instead of racing the count.
        throw new Error("rate limit lock slot is missing");
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - HOUR_MS).toISOString();

      const windowStart =
        meter.dailyLimit === undefined
          ? oneHourAgo
          : new Date(now.getTime() - DAY_MS).toISOString();

      const [counts] = await tx
        .select({
          hourly:
            sql<number>`(count(*) filter (where ${uploadRateLimits.createdAt} >= ${oneHourAgo}))::int`.mapWith(
              Number,
            ),
          daily: sql<number>`count(*)::int`.mapWith(Number),
          oldestHourly: sql<
            string | null
          >`MIN(${uploadRateLimits.createdAt}) filter (where ${uploadRateLimits.createdAt} >= ${oneHourAgo})`,
          oldestDaily: sql<string | null>`MIN(${uploadRateLimits.createdAt})`,
        })
        .from(uploadRateLimits)
        .where(
          and(
            eq(uploadRateLimits.ipHash, ipHash),
            eq(uploadRateLimits.actionType, meter.actionType),
            gte(uploadRateLimits.createdAt, windowStart),
          ),
        );

      const hourly = counts?.hourly ?? 0;
      const daily = counts?.daily ?? 0;

      if (hourly >= meter.hourlyLimit) {
        return { kind: "hourly-full", daily, oldest: counts?.oldestHourly ?? null };
      }

      if (meter.dailyLimit !== undefined && daily >= meter.dailyLimit) {
        return { kind: "daily-full", hourly, oldest: counts?.oldestDaily ?? null };
      }

      await tx.insert(uploadRateLimits).values({
        id: crypto.randomUUID(),
        ipHash,
        actionType: meter.actionType,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + meter.ttlMs).toISOString(),
      });

      return { kind: "recorded", hourly: hourly + 1, daily: daily + 1 };
    }),
  );
}

/** Seconds until the oldest in-window row leaves it; the full window if there is none. */
function retryAfterSeconds(oldest: string | null, windowMs: number): number {
  if (oldest === null) return windowMs / 1000;

  return Math.max(1, Math.ceil((new Date(oldest).getTime() + windowMs - Date.now()) / 1000));
}

function uploadDecision(ip: string): Effect.Effect<Decision, RateLimitUnavailable, Db> {
  if (limitsBypassed(ip)) {
    return Effect.succeed({
      allowed: true,
      remaining: { hourly: HOURLY_LIMIT, daily: DAILY_LIMIT },
    });
  }

  return Effect.promise(() => hashIP(ip)).pipe(
    Effect.flatMap((ipHash) => meterAction(ipHash, UPLOAD_METER)),
    Effect.mapError(storeDown("upload", UPLOAD_UNAVAILABLE_MESSAGE)),
    Effect.map((metered): Decision => {
      switch (metered.kind) {
        case "recorded":
          return {
            allowed: true,
            remaining: {
              hourly: Math.max(0, HOURLY_LIMIT - metered.hourly),
              daily: Math.max(0, DAILY_LIMIT - metered.daily),
            },
          };
        case "hourly-full":
          return {
            allowed: false,
            remaining: { hourly: 0, daily: Math.max(0, DAILY_LIMIT - metered.daily) },
            message: `Too many upload requests. Try again in an hour. (Limit: ${HOURLY_LIMIT}/hour)`,
            retryAfterSeconds: retryAfterSeconds(metered.oldest, HOUR_MS),
          };
        case "daily-full":
          return {
            allowed: false,
            remaining: { hourly: Math.max(0, HOURLY_LIMIT - metered.hourly), daily: 0 },
            message: `Daily upload limit reached. Try again tomorrow. (Limit: ${DAILY_LIMIT}/day)`,
            retryAfterSeconds: retryAfterSeconds(metered.oldest, DAY_MS),
          };
      }
    }),
  );
}

function handleCheckDecision(ip: string): Effect.Effect<Decision, RateLimitUnavailable, Db> {
  if (limitsBypassed(ip)) {
    return Effect.succeed({
      allowed: true,
      remaining: { hourly: HANDLE_CHECK_HOURLY_LIMIT, daily: 1000 },
    });
  }

  return Effect.promise(() => hashIP(ip)).pipe(
    Effect.flatMap((ipHash) => meterAction(ipHash, HANDLE_CHECK_METER)),
    Effect.mapError(storeDown("handle_check", HANDLE_UNAVAILABLE_MESSAGE)),
    Effect.map((metered): Decision => {
      if (metered.kind === "recorded") {
        return {
          allowed: true,
          remaining: { hourly: HANDLE_CHECK_HOURLY_LIMIT - metered.hourly, daily: 1000 },
        };
      }

      return {
        allowed: false,
        remaining: { hourly: 0, daily: 0 },
        message: "Too many handle checks. Please try again later.",
        retryAfterSeconds: retryAfterSeconds(metered.oldest, HOUR_MS),
      };
    }),
  );
}

/** Turns a refusal into the `RateLimited` failure; an allowance keeps its remaining counts. */
function admit(
  decision: Effect.Effect<Decision, RateLimitUnavailable, Db>,
): Effect.Effect<{ remaining: Remaining }, RateLimited | RateLimitUnavailable, Db> {
  return Effect.flatMap(decision, (result) =>
    result.allowed
      ? Effect.succeed({ remaining: result.remaining })
      : Effect.fail(
          new RateLimited({
            message: result.message,
            retryAfterSeconds: result.retryAfterSeconds,
          }),
        ),
  );
}

/**
 * Upload limiter per client address (10/hour, 50/day). Store outage: `RateLimitUnavailable`
 * (503 + Retry-After), the upload is refused rather than let through unmetered.
 */
export function checkIPRateLimitEffect(ip: string) {
  return admit(uploadDecision(ip));
}

/**
 * Handle-availability limiter per client address (100/hour). Store outage: `RateLimitUnavailable`
 * (503 + Retry-After). This limiter used to fail open; it now fails closed, like uploads.
 */
export function checkHandleRateLimitEffect(ip: string) {
  return admit(handleCheckDecision(ip));
}

const clientIpSchema = z.union([z.ipv4(), z.ipv6()]);

/** Header text is attacker-controlled: anything that is not an IP address shares one bucket. */
function ipOrUnknown(raw: string): string {
  const parsed = clientIpSchema.safeParse(raw.trim());

  return parsed.success ? parsed.data : UNKNOWN_IP;
}

export function getClientIP(request: Request): string {
  const cfIP = request.headers.get("cf-connecting-ip");

  if (cfIP) return ipOrUnknown(cfIP);

  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) return ipOrUnknown(forwarded.split(",")[0]);

  return UNKNOWN_IP;
}
