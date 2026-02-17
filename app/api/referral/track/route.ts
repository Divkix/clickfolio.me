/**
 * POST /api/referral/track
 *
 * Receives referral click beacons from the ReferralCapture component.
 * Tracks clicks on referral links for analytics.
 *
 * Supports both referral codes (new) and handles (backward compatible).
 * - First tries to match `code` as a referral code (uppercase)
 * - Falls back to matching as a handle (lowercase)
 *
 * Always returns 204 — tracking must never leak info or break the page.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralClicks, user } from "@/lib/db/schema";
import { generateVisitorHash, isBot } from "@/lib/utils/analytics";
import { getClientIP } from "@/lib/utils/ip-rate-limit";

const EMPTY_204 = new Response(null, { status: 204 });

interface TrackRequestBody {
  code?: string;
  handle?: string; // Backward compatibility
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

    const { source } = body;
    // Prefer `code`, fall back to `handle` for backward compatibility
    const code = body.code || body.handle;

    // Validate code exists
    if (!code || typeof code !== "string" || code.trim() === "") {
      return EMPTY_204;
    }

    // Reject absurdly long inputs to prevent DB issues
    if (code.length > 64) {
      return EMPTY_204;
    }

    // Validate source at runtime (not just TypeScript type)
    const validSources = ["homepage", "cta", "share"] as const;
    const validatedSource =
      source && validSources.includes(source as (typeof validSources)[number])
        ? (source as (typeof validSources)[number])
        : null;

    // Bot detection
    const ua = request.headers.get("user-agent") || "";
    if (isBot(ua)) {
      return EMPTY_204;
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Single query: match referralCode (uppercase) OR handle (lowercase) in one roundtrip
    const userResult = await db
      .select({ id: user.id })
      .from(user)
      .where(or(eq(user.referralCode, code.toUpperCase()), eq(user.handle, code.toLowerCase())))
      .limit(1);

    if (userResult.length === 0) {
      return EMPTY_204;
    }

    const referrerUserId = userResult[0].id;

    // Generate visitor hash
    const ip = getClientIP(request);
    const visitorHash = await generateVisitorHash(ip, ua);

    // Insert referral click (idempotent).
    // Uniqueness is enforced at the DB layer via UNIQUE(referrer_user_id, visitor_hash).
    await db
      .insert(referralClicks)
      .values({
        id: crypto.randomUUID(),
        referrerUserId,
        visitorHash,
        source: validatedSource,
        converted: false,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    return EMPTY_204;
  } catch (error) {
    // Tracking failures are acceptable — never break the page
    console.error("[referral/track] Error:", error);
    return EMPTY_204;
  }
}
