import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { privacySettingsSchema } from "@/lib/schemas/profile";
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
    // 1. Authenticate user
    const authResult = await requireAuthWithMessage(
      "You must be logged in to update privacy settings",
    );
    if (authResult.error) return authResult.error;
    const { user: authUser } = authResult;

    // 2. Get database connection
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 3. Parse and validate request body
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

    const { show_phone, show_address } = validation.data;

    // 4. Update privacy_settings (stored as JSON string in D1)
    const privacySettings = JSON.stringify({
      show_phone,
      show_address,
    });

    await db
      .update(user)
      .set({
        privacySettings,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    await captureBookmark();
    return createSuccessResponse({
      success: true,
      privacy_settings: {
        show_phone,
        show_address,
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
