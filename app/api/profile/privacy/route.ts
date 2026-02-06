import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { purgeResumeCache } from "@/lib/cloudflare-cache-purge";
import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * PUT /api/profile/privacy
 * Update user's privacy settings (show_phone, show_address)
 */
export async function PUT(request: Request) {
  try {
    // 1. Authenticate user and validate existence in database
    // env is returned from requireAuthWithUserValidation, no separate getCloudflareContext needed
    const {
      user: authUser,
      db,
      captureBookmark,
      dbUser,
      env,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update privacy settings");
    if (authError) return authError;

    const userHandle = dbUser.handle;

    // 2. Parse and validate request body
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

    // 3. Update privacy_settings (stored as JSON string in D1)
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
        showInDirectory: show_in_directory,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    // 4. Purge edge cache for privacy changes (fire-and-forget)
    // This prevents PII exposure through stale edge cache
    if (userHandle) {
      const cfZoneId = env.CF_ZONE_ID;
      const cfApiToken = env.CF_CACHE_PURGE_API_TOKEN;
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
