import { Effect } from "effect";
import { and, eq, gte, sql } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { handleChanges, resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { RateLimited, type RateLimitUnavailable } from "@/lib/effect/failures";
import { limitsBypassed } from "./bypass";
import { storeDown } from "./store-failure";

export const RATE_LIMITS = {
  handle_change: { limit: 3, windowHours: 24 },
  resume_upload: {
    limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_DAY) || 5,
    windowHours: 24,
  },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;

const USER_UNAVAILABLE_MESSAGE =
  "Rate limiting service temporarily unavailable. Please try again in a few moments.";

/** Pass a transaction handle so quota reads run under the caller's user-row lock. */
export async function countHandleChangesInWindow(db: PgQueryable, userId: string): Promise<number> {
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

  return Number(result[0]?.count ?? 0);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

type Usage = { count: number; oldest: string | null };

async function readUsage(
  db: PgQueryable,
  userId: string,
  action: RateLimitAction,
  windowStart: string,
): Promise<Usage> {
  switch (action) {
    case "handle_change": {
      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`.mapWith(Number),
          oldest: sql<string | null>`MIN(${handleChanges.createdAt})`,
        })
        .from(handleChanges)
        .where(and(eq(handleChanges.userId, userId), gte(handleChanges.createdAt, windowStart)));

      return { count: row?.count ?? 0, oldest: row?.oldest ?? null };
    }

    case "resume_upload": {
      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`.mapWith(Number),
          oldest: sql<string | null>`MIN(${resumes.createdAt})`,
        })
        .from(resumes)
        .where(and(eq(resumes.userId, userId), gte(resumes.createdAt, windowStart)));

      return { count: row?.count ?? 0, oldest: row?.oldest ?? null };
    }

    default: {
      const _exhaustive: never = action;
      // SAFETY: _exhaustive is never from exhaustive switch; cast to string for error message when new action added without handler.
      throw new Error(`Unknown rate limit action: ${_exhaustive as string}`);
    }
  }
}

/** The quota as `db` sees it: a read, not a reservation. Callers hold their own lock around it. */
async function evaluateQuota(
  db: PgQueryable,
  userId: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const windowMs = config.windowHours * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const usage = await readUsage(db, userId, action, windowStart);

  const oldestMs = usage.oldest === null ? Number.NaN : new Date(usage.oldest).getTime();
  const resetAt = new Date(Number.isNaN(oldestMs) ? Date.now() + windowMs : oldestMs + windowMs);
  const allowed = usage.count < config.limit;

  return {
    allowed,
    remaining: Math.max(0, config.limit - usage.count),
    resetAt,
    message: allowed
      ? undefined
      : `Rate limit exceeded. Maximum ${config.limit} ${action.replace("_", " ")} per ${config.windowHours} hour(s). Try again later.`,
  };
}

function readWindow(userId: string, action: RateLimitAction) {
  return Db.use((service) =>
    service.query(`rate-limit.user.${action}`, (db) => evaluateQuota(db, userId, action)),
  ).pipe(Effect.mapError(storeDown(action, USER_UNAVAILABLE_MESSAGE)));
}

/**
 * The quota read on a transaction handle, for a caller that must count under the user-row lock
 * it already holds in that transaction (a Promise body cannot run `enforceRateLimitEffect`).
 * A database failure surfaces as the transaction's own `DbFailed`, which also fails closed.
 * Turn the result into the failure with {@link requireQuota} once the transaction is done.
 */
export function readQuotaIn(
  db: PgQueryable,
  userId: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  if (limitsBypassed()) {
    return Promise.resolve({
      allowed: true,
      remaining: RATE_LIMITS[action].limit,
      resetAt: new Date(),
    });
  }

  return evaluateQuota(db, userId, action);
}

/** `RateLimited` when the quota read by {@link readQuotaIn} is spent. */
export function requireQuota(quota: RateLimitResult): Effect.Effect<void, RateLimited> {
  return quota.allowed
    ? Effect.void
    : Effect.fail(
        new RateLimited({
          message: quota.message ?? "Rate limit exceeded.",
          retryAfterSeconds: retryAfterSeconds(quota.resetAt),
        }),
      );
}

function retryAfterSeconds(resetAt: Date): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}

/**
 * Per-user quota check (3 handle changes / 24 h, 5 resume uploads / 24 h by default).
 * Store outage: `RateLimitUnavailable` (503 + Retry-After), never "allowed".
 * Succeeds when the user is under quota; callers that insert in the same transaction
 * must still take their own user-row lock, this only reads.
 */
export function enforceRateLimitEffect(
  userId: string,
  action: RateLimitAction,
): Effect.Effect<void, RateLimited | RateLimitUnavailable, Db> {
  if (limitsBypassed()) return Effect.void;

  return Effect.flatMap(readWindow(userId, action), requireQuota);
}
