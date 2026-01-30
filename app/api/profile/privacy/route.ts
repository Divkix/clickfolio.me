import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { purgeResumeCache } from "@/lib/cloudflare-cache-purge";
import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * PUT /api/profile/privacy
 * Update user's privacy settings (show_phone, show_address)
 * Rate limit: 20 updates per hour (more generous for toggle settings)
 */
export async function PUT(request: Request) {
  try {
    // 1. Authenticate user and validate existence in database
    const { env } = await getCloudflareContext({ async: true });
    const {
      user: authUser,
      db,
      captureBookmark,
      dbUser,
      error: authError,
    } = await requireAuthWithUserValidation(
      "You must be logged in to update privacy settings",
      env.DB,
    );
    if (authError) return authError;

    const userHandle = dbUser.handle;

    // 2. Rate limit check (20 updates per hour)
    const rateLimitResponse = await enforceRateLimit(authUser.id, "privacy_update");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 5. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const validation = privacySettingsSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse(
        "Invalid privacy settings data",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        validation.error.issues,
      );
    }

    const { show_phone, show_address, hide_from_search, show_in_directory } = validation.data;

    // 6. Update privacy_settings (stored as JSON string in D1)
    const privacySettings = JSON.stringify({
      show_phone,
      show_address,
      hide_from_search,
      show_in_directory,
    });

    await db
      .update(user)
      .set({
        privacySettings,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    // 7. Purge edge cache for privacy changes (fire-and-forget)
    // This prevents PII exposure through stale edge cache
    if (userHandle) {
      const cfZoneId = (env as CloudflareEnv).CF_ZONE_ID;
      const cfApiToken = (env as CloudflareEnv).CF_CACHE_PURGE_API_TOKEN;
      const baseUrl = process.env.BETTER_AUTH_URL;

      if (cfZoneId && cfApiToken && baseUrl) {
        // Fire-and-forget: don't block response on cache purge
        purgeResumeCache(userHandle, baseUrl, cfZoneId, cfApiToken).catch(() => {
          // Error already logged inside purgeResumeCache
        });
      }
    }

    await captureBookmark();
    return createSuccessResponse({
      success: true,
      privacy_settings: {
        show_phone,
        show_address,
        hide_from_search,
        show_in_directory,
      },
    });
  } catch (err) {
    console.error("Unexpected error in privacy update:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
