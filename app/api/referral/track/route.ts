/**
 * POST /api/referral/track
 *
 * Receives referral click beacons from the ReferralCapture component.
 * Tracks clicks on referral links for analytics.
 *
 * Always returns 204 — tracking must never leak info or break the page.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";
import { generateVisitorHash, isBot } from "@/lib/utils/analytics";
import { isValidHandleFormat } from "@/lib/utils/handle-validation";
import { getClientIP } from "@/lib/utils/ip-rate-limit";

const EMPTY_204 = new Response(null, { status: 204 });

interface TrackRequestBody {
  handle?: string;
  source?: "homepage" | "cta" | "share";
}

export async function POST(request: Request) {
  try {
    // Parse body
    let body: TrackRequestBody;
    try {
      body = await request.json();
    } catch {
      return EMPTY_204;
    }

    const { handle, source } = body;

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

    // Resolve handle → userId (the referrer)
    const userResult = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, handle))
      .limit(1);

    if (userResult.length === 0) {
      return EMPTY_204;
    }

    const referrerUserId = userResult[0].id;

    // Generate visitor hash
    const ip = getClientIP(request);
    const visitorHash = await generateVisitorHash(ip, ua);

    // Dedup: same visitorHash + referrerUserId within 24 hours
    // (we want unique visitors per referrer per day)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dedupResult = await db
      .select({ id: referralClicks.id })
      .from(referralClicks)
      .where(
        and(
          eq(referralClicks.visitorHash, visitorHash),
          eq(referralClicks.referrerUserId, referrerUserId),
          gte(referralClicks.createdAt, twentyFourHoursAgo),
        ),
      )
      .limit(1);

    if (dedupResult.length > 0) {
      return EMPTY_204;
    }

    // Insert referral click
    await db.insert(referralClicks).values({
      id: crypto.randomUUID(),
      referrerUserId,
      visitorHash,
      source: source || null,
      converted: false,
      createdAt: new Date().toISOString(),
    });

    return EMPTY_204;
  } catch (error) {
    // Tracking failures are acceptable — never break the page
    console.error("[referral/track] Error:", error);
    return EMPTY_204;
  }
}
