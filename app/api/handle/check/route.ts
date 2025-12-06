import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/handle/check?handle=example
 * Check if a handle is available (public endpoint)
 */
export async function GET(request: Request) {
  try {
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

    // 4. Get database connection
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // 5. Check if handle exists in database
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    const available = existingUser.length === 0;

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
