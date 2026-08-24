import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

/**
 * PUT /api/profile/privacy
 * Update user's privacy settings.
 *
 * Request body fields:
 *   - show_phone: boolean
 *   - show_address: boolean
 *   - hide_from_search: boolean
 *   - show_in_directory: boolean
 *
 * Error codes:
 *   - 400: invalid JSON or validation failure
 *   - 413: request body too large
 *   - 500: unexpected error
 */
export async function PUT(request: Request) {
  // Validate request size before parsing (prevent DoS)
  const sizeCheck = validateRequestSize(request);
  if (!sizeCheck.valid) {
    return createErrorResponse(
      sizeCheck.error || "Request body too large",
      ERROR_CODES.BAD_REQUEST,
      413,
    );
  }

  return withUser(
    request,
    async ({ user: authUser, db }) => {
      // Parse and validate request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }

      const validation = privacySettingsSchema.safeParse(rawBodyResult.data);

      if (!validation.success) {
        return createErrorResponse(
          "Invalid privacy settings data",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const { show_phone, show_address, hide_from_search, show_in_directory } = validation.data;

      // Update privacy_settings (jsonb) and its denormalized directory column together
      const privacySettings = {
        show_phone,
        show_address,
        hide_from_search,
        show_in_directory,
      };

      await db
        .update(user)
        .set({
          privacySettings,
          showInDirectory: show_in_directory,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(user.id, authUser.id));

      return createSuccessResponse({
        success: true,
        privacy_settings: {
          show_phone,
          show_address,
          hide_from_search,
          show_in_directory,
        },
      });
    },
    "You must be logged in to update privacy settings",
  );
}
