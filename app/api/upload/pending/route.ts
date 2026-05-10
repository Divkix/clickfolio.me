/**
 * Pending Upload Cookie API
 *
 * Manages HTTP-only signed cookies for the anonymous upload -> auth claim flow.
 * Replaces fragile sessionStorage with secure server-side cookie management.
 *
 * Endpoints:
 * - POST: Set cookie after successful R2 upload
 * - GET: Retrieve pending upload key for claim flow
 * - DELETE: Clear cookie after successful claim
 */

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnvValue } from "@/lib/auth";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createSignedCookieValue,
  parseSignedCookieValue,
} from "@/lib/utils/pending-upload-cookie";

/**
 * POST - Set pending upload cookie after R2 upload
 *
 * Called by FileDropzone after successful file upload to R2.
 * Stores the temp key in an HTTP-only signed cookie for later claim.
 */
export async function POST(request: Request) {
  try {
    const typedEnv = env as Partial<CloudflareEnv>;
    const secret = getEnvValue(typedEnv, "BETTER_AUTH_SECRET");

    const body = (await request.json()) as { key?: string };
    const { key } = body;

    // Validate the key format (must be temp upload)
    if (!key || typeof key !== "string" || !key.startsWith("temp/")) {
      return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
    }

    // Create signed cookie value
    const cookieValue = await createSignedCookieValue(key, secret);
    const cookieStore = await cookies();

    // Set HTTP-only cookie with secure settings
    cookieStore.set(COOKIE_NAME, cookieValue, {
      httpOnly: true, // Prevents XSS access
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: "lax", // Allows OAuth redirect flow
      maxAge: COOKIE_MAX_AGE, // 30 minutes
      path: "/", // Available site-wide
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting pending upload cookie:", error);
    return NextResponse.json({ error: "Failed to save upload" }, { status: 500 });
  }
}

/**
 * GET - Retrieve pending upload key from cookie
 *
 * Called by wizard page to check for pending upload to claim.
 * Returns null values if no valid cookie exists.
 */
export async function GET() {
  try {
    const typedEnv = env as Partial<CloudflareEnv>;
    const secret = getEnvValue(typedEnv, "BETTER_AUTH_SECRET");

    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);

    // No cookie present
    if (!cookie?.value) {
      return NextResponse.json({ key: null });
    }

    // Parse and verify the signed cookie
    const parsed = await parseSignedCookieValue(cookie.value, secret);

    // Invalid or expired cookie - return null (client calls DELETE to clean up)
    if (!parsed) {
      return NextResponse.json({ key: null });
    }

    return NextResponse.json({
      key: parsed.tempKey,
    });
  } catch (error) {
    console.error("Error reading pending upload cookie:", error);
    return NextResponse.json({ key: null });
  }
}

/**
 * DELETE - Clear pending upload cookie
 *
 * Called after successful claim to clean up the cookie.
 * Also used on error to prevent stale state.
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing pending upload cookie:", error);
    // Still return success - cookie deletion is best effort
    return NextResponse.json({ success: true });
  }
}
