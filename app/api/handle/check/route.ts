import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { RESERVED_HANDLES } from "@/lib/utils/handle-validation";
import { checkHandleRateLimit, getClientIP } from "@/lib/utils/ip-rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/handle/check?handle=example
 * Check if a handle is available (public endpoint)
 * Rate limited by IP to prevent username enumeration
 *
 * Optimization notes (this is the highest-volume endpoint, called every ~500ms while typing):
 * 1. Format validation runs BEFORE rate limiting — invalid handles never touch D1
 * 2. Uses plain getDb() instead of getSessionDb() — read-only, no cookie/bookmark overhead
 * 3. Auth is deferred — only resolved when handle IS taken (to distinguish "yours" vs "taken")
 *    Available handles return immediately with zero auth cost.
 */
export async function GET(request: Request) {
  try {
    // 1. Parse and validate handle format BEFORE any D1 operations
    //    This rejects invalid input (bad chars, too short, reserved) for free.
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return createErrorResponse("handle parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    const normalizedHandle = handle.toLowerCase().trim();

    if (normalizedHandle.length < 3) {
      return createErrorResponse(
        "Handle must be at least 3 characters",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    if (normalizedHandle.length > 30) {
      return createErrorResponse(
        "Handle must be at most 30 characters",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    if (!/^[a-z0-9-]+$/.test(normalizedHandle)) {
      return createErrorResponse(
        "Handle can only contain lowercase letters, numbers, and hyphens",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    if (/^-|-$/.test(normalizedHandle)) {
      return createErrorResponse(
        "Handle cannot start or end with a hyphen",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    if (/--/.test(normalizedHandle)) {
      return createErrorResponse(
        "Handle cannot contain consecutive hyphens",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // Check reserved handles — pure in-memory Set lookup, no D1
    if (RESERVED_HANDLES.has(normalizedHandle)) {
      return createSuccessResponse({ available: false, reason: "reserved" });
    }

    // 2. IP-based rate limiting (only reached for validly-formatted handles)
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkHandleRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        rateLimitResult.message || "Too many requests. Please try again later.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    // 3. Check if handle exists in database
    //    Plain getDb() — this is a read-only availability check, no need for
    //    session consistency (bookmark cookies) or D1 session wrappers.
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    // 4. Handle is available — return immediately, skip auth entirely
    if (existingUser.length === 0) {
      return createSuccessResponse({ available: true });
    }

    // 5. Handle is taken — resolve auth only now to check "is it yours?"
    //    This avoids BetterAuth init + D1 session lookup on the happy path.
    let currentUserId: string | null = null;
    try {
      const auth = await getAuth();
      const headersList = await headers();
      const session = await auth.api.getSession({ headers: headersList });
      currentUserId = session?.user?.id ?? null;
    } catch {
      // Not authenticated — continue as public endpoint
    }

    if (currentUserId && existingUser[0].id === currentUserId) {
      return createSuccessResponse({ available: true, isCurrentHandle: true });
    }

    // Taken by another user
    return createSuccessResponse({ available: false });
  } catch (err) {
    console.error("Error checking handle availability:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
