/**
 * POST /api/analytics/track
 *
 * Receives page view beacons from the client-side AnalyticsBeacon component.
 * Processes: bot filter → handle→userId → self-view skip → dedup → insert.
 *
 * Always returns 204 — analytics must never leak info or break the page.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gte } from "drizzle-orm";
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

export async function POST(request: Request) {
  try {
    // Parse body
    let body: { handle?: string; referrer?: string };
    try {
      body = await request.json();
    } catch {
      return EMPTY_204;
    }

    const { handle, referrer } = body;

    // Validate handle
    if (!handle || typeof handle !== "string" || !isValidHandleFormat(handle)) {
      return EMPTY_204;
    }

    // Bot detection
    const ua = request.headers.get("user-agent") || "";
    if (isBot(ua)) {
      return EMPTY_204;
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Resolve handle → userId
    const userResult = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, handle))
      .limit(1);

    if (userResult.length === 0) {
      return EMPTY_204;
    }

    const userId = userResult[0].id;

    // Self-view detection: check session cookie
    const sessionToken = extractSessionToken(request);
    if (sessionToken) {
      const sessionResult = await db
        .select({ userId: sessionTable.userId })
        .from(sessionTable)
        .where(eq(sessionTable.token, sessionToken))
        .limit(1);

      if (sessionResult.length > 0 && sessionResult[0].userId === userId) {
        // Owner viewing their own page — skip
        return EMPTY_204;
      }
    }

    // Generate visitor hash
    const ip = getClientIP(request);
    const visitorHash = await generateVisitorHash(ip, ua);

    // Dedup: same visitorHash + userId within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const dedupResult = await db
      .select({ id: pageViews.id })
      .from(pageViews)
      .where(
        and(
          eq(pageViews.visitorHash, visitorHash),
          eq(pageViews.userId, userId),
          gte(pageViews.createdAt, fiveMinutesAgo),
        ),
      )
      .limit(1);

    if (dedupResult.length > 0) {
      return EMPTY_204;
    }

    // Extract metadata
    const country = request.headers.get("cf-ipcountry") || null;
    const deviceType = getDeviceType(ua);
    const referrerHostname = parseReferrerHostname(
      referrer || request.headers.get("referer"),
      siteConfig.domain,
    );

    // Insert page view
    await db.insert(pageViews).values({
      id: crypto.randomUUID(),
      userId,
      visitorHash,
      referrer: referrerHostname,
      country: country === "XX" ? null : country, // CF returns "XX" for unknown
      deviceType,
      createdAt: new Date().toISOString(),
    });

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
