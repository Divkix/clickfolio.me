import { createClient } from "@/lib/supabase/server";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { requireAuthWithMessage } from "@/lib/auth/middleware";

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
    const { user } = authResult;

    const supabase = await createClient();

    // 2. Check rate limit (20 updates per hour)
    const rateLimitResponse = await enforceRateLimit(user.id, "privacy_update");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 3. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "Invalid JSON in request body",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
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

    // 4. Update privacy_settings JSONB column
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        privacy_settings: {
          show_phone,
          show_address,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("privacy_settings")
      .single();

    if (updateError) {
      console.error("Privacy settings update error:", updateError);
      return createErrorResponse(
        "Failed to update privacy settings. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    return createSuccessResponse({
      success: true,
      privacy_settings: data.privacy_settings,
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
