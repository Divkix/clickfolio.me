import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
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
 */
export async function GET(request: Request) {
  try {
    // 0. IP-based rate limiting to prevent username enumeration
    // Uses separate limit (100/hr) from uploads (10/hr) since this is a cheap read
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkHandleRateLimit(clientIP);

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

    if (/--/.test(normalizedHandle)) {
      return createErrorResponse(
        "Handle cannot contain consecutive hyphens",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 3. Check reserved handles
    if (RESERVED_HANDLES.has(normalizedHandle)) {
      return createSuccessResponse({ available: false, reason: "reserved" });
    }

    // 4. Get database connection with session consistency
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 4b. Optional auth — detect current user for own-handle check
    let currentUserId: string | null = null;
    try {
      const auth = await getAuth();
      const headersList = await headers();
      const session = await auth.api.getSession({ headers: headersList });
      currentUserId = session?.user?.id ?? null;
    } catch {
      // Not authenticated — continue as public endpoint
    }

    // 5. Check if handle exists in database
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    // Capture bookmark for session consistency (read-your-own-writes)
    await captureBookmark();

    if (existingUser.length === 0) {
      return createSuccessResponse({ available: true });
    }

    // Handle belongs to current user
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
