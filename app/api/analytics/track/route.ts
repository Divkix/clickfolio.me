/**
 * POST /api/analytics/track
 *
 * Receives page view beacons from the client-side AnalyticsBeacon component.
 * Supports both single events and batches (up to 10 events).
 * Processes: bot filter → handle→userId → self-view skip → dedup → insert.
 *
 * Always returns 204 — analytics must never leak info or break the page.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gte, inArray } from "drizzle-orm";
import { siteConfig } from "@/lib/config/site";
import { getDb } from "@/lib/db";
import { pageViews, session as sessionTable, user } from "@/lib/db/schema";
import {
  generateVisitorHash,
  getDeviceType,
  isBot,
  parseReferrerHostname,
} from "@/lib/utils/analytics";
import { isValidHandleFormat } from "@/lib/utils/handle-validation";
import { getClientIP } from "@/lib/utils/ip-rate-limit";

const EMPTY_204 = new Response(null, { status: 204 });
const MAX_BATCH_SIZE = 10;

type RawEvent = {
  handle?: string;
  referrer?: string;
  ts?: number;
};

type ValidatedEvent = {
  handle: string;
  referrer: string | null;
  ts: number;
};

export async function POST(request: Request) {
  try {
    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return EMPTY_204;
    }

    // Normalize to array (backward compatible with single object)
    const rawEvents = Array.isArray(body) ? body : [body];

    // Validate batch size
    if (rawEvents.length === 0 || rawEvents.length > MAX_BATCH_SIZE) {
      return EMPTY_204;
    }

    // Bot detection (once per request - same UA for all events in batch)
    const ua = request.headers.get("user-agent") || "";
    if (isBot(ua)) {
      return EMPTY_204;
    }

    // Validate and filter events
    const validEvents: ValidatedEvent[] = [];
    for (const event of rawEvents as RawEvent[]) {
      if (event?.handle && typeof event.handle === "string" && isValidHandleFormat(event.handle)) {
        validEvents.push({
          handle: event.handle,
          referrer: typeof event.referrer === "string" ? event.referrer : null,
          ts: typeof event.ts === "number" ? event.ts : Date.now(),
        });
      }
    }

    if (validEvents.length === 0) {
      return EMPTY_204;
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Get unique handles from batch
    const uniqueHandles = [...new Set(validEvents.map((e) => e.handle))];

    // Batch resolve handles → userIds (single query with IN clause)
    const userResults = await db
      .select({ id: user.id, handle: user.handle })
      .from(user)
      .where(inArray(user.handle, uniqueHandles));

    if (userResults.length === 0) {
      return EMPTY_204;
    }

    // Build handle → userId lookup map
    const handleToUserId = new Map<string, string>(userResults.map((u) => [u.handle!, u.id]));

    // Self-view detection: check session cookie
    let selfViewUserId: string | null = null;
    const sessionToken = extractSessionToken(request);
    if (sessionToken) {
      const sessionResult = await db
        .select({ userId: sessionTable.userId })
        .from(sessionTable)
        .where(eq(sessionTable.token, sessionToken))
        .limit(1);

      if (sessionResult.length > 0) {
        selfViewUserId = sessionResult[0].userId;
      }
    }

    // Generate visitor hash (same for all events - same IP/UA for entire batch)
    const ip = getClientIP(request);
    const visitorHash = await generateVisitorHash(ip, ua);

    // Map events to userIds, filter out:
    // - Events with handles that don't exist (no userId found)
    // - Self-views (owner viewing their own page)
    type EventWithUserId = ValidatedEvent & { userId: string };
    const eventsWithUserIds: EventWithUserId[] = [];

    for (const event of validEvents) {
      const userId = handleToUserId.get(event.handle);
      if (userId && userId !== selfViewUserId) {
        eventsWithUserIds.push({ ...event, userId });
      }
    }

    if (eventsWithUserIds.length === 0) {
      return EMPTY_204;
    }

    // Get unique userIds for batch dedup check
    const uniqueUserIds = [...new Set(eventsWithUserIds.map((e) => e.userId))];

    // Batch dedup: find existing views for this visitor + any of these users in last 5 min
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const existingViews = await db
      .select({ userId: pageViews.userId })
      .from(pageViews)
      .where(
        and(
          eq(pageViews.visitorHash, visitorHash),
          inArray(pageViews.userId, uniqueUserIds),
          gte(pageViews.createdAt, fiveMinutesAgo),
        ),
      );

    // Build set of userIds that already have a recent view from this visitor
    const existingUserIds = new Set(existingViews.map((v) => v.userId));

    // Filter out:
    // - Events for users who already have a view in dedup window
    // - Duplicate events within batch (keep first per userId)
    const seenUserIds = new Set<string>();
    const eventsToInsert: EventWithUserId[] = [];

    for (const event of eventsWithUserIds) {
      if (!existingUserIds.has(event.userId) && !seenUserIds.has(event.userId)) {
        seenUserIds.add(event.userId);
        eventsToInsert.push(event);
      }
    }

    if (eventsToInsert.length === 0) {
      return EMPTY_204;
    }

    // Extract common metadata (same for all events in batch)
    const country = request.headers.get("cf-ipcountry") || null;
    const deviceType = getDeviceType(ua);
    const now = new Date().toISOString();

    // Batch insert all remaining events
    await db.insert(pageViews).values(
      eventsToInsert.map((event) => ({
        id: crypto.randomUUID(),
        userId: event.userId,
        visitorHash,
        referrer: parseReferrerHostname(
          event.referrer || request.headers.get("referer"),
          siteConfig.domain,
        ),
        country: country === "XX" ? null : country, // CF returns "XX" for unknown
        deviceType,
        createdAt: now,
      })),
    );

    return EMPTY_204;
  } catch (error) {
    // Analytics failures are acceptable — never break the page
    console.error("[analytics/track] Error:", error);
    return EMPTY_204;
  }
}

/**
 * Extract Better Auth session token from cookies.
 * Better Auth uses "better-auth.session_token" cookie name.
 */
function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  // Match both "better-auth.session_token" and "__Secure-better-auth.session_token"
  const match = cookieHeader.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
