import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { checkIPRateLimit, getClientIP } from "@/lib/utils/ip-rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/handle/check?handle=example
 * Check if a handle is available (public endpoint)
 * Rate limited by IP to prevent username enumeration
 */
export async function GET(request: Request) {
  try {
    // 0. IP-based rate limiting to prevent username enumeration
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkIPRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        rateLimitResult.message || "Too many requests. Please try again later.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    // 1. Get handle from query params
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return createErrorResponse("handle parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 2. Validate handle format
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

    // 3. Check reserved handles
    const reservedHandles = [
      "admin",
      "api",
      "auth",
      "dashboard",
      "edit",
      "login",
      "logout",
      "settings",
      "wizard",
      "waiting",
      "onboarding",
      "profile",
      "resume",
      "help",
      "support",
      "about",
      "terms",
      "privacy",
      "contact",
    ];

    if (reservedHandles.includes(normalizedHandle)) {
      return createSuccessResponse({ available: false, reason: "reserved" });
    }

    // 4. Get database connection with session consistency
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 5. Check if handle exists in database
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    const available = existingUser.length === 0;

    // Capture bookmark for session consistency (read-your-own-writes)
    await captureBookmark();

    return createSuccessResponse({ available });
  } catch (err) {
    console.error("Error checking handle availability:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
